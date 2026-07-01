using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Coconut.Api.Data;
using Coconut.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Coconut.Api.Services;

public class AiService
{
    private readonly CoconutDbContext _db;
    private readonly EncryptionService _encryption;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<AiService> _logger;

    public AiService(CoconutDbContext db, EncryptionService encryption,
        IHttpClientFactory httpFactory, ILogger<AiService> logger)
    {
        _db = db;
        _encryption = encryption;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<AiChatSession> CreateSessionAsync(string title, Guid providerId,
        Guid? connectionId = null, string? systemPrompt = null)
    {
        var session = new AiChatSession
        {
            Title = title,
            AiProviderId = providerId,
            SshConnectionId = connectionId,
            SystemPrompt = systemPrompt
        };
        _db.AiChatSessions.Add(session);
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<List<AiChatSession>> GetSessionsAsync()
    {
        return await _db.AiChatSessions
            .Include(s => s.AiProvider)
            .OrderByDescending(s => s.UpdatedAt)
            .ToListAsync();
    }

    public async Task<List<AiChatMessage>> GetMessagesAsync(Guid sessionId)
    {
        return await _db.AiChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<AiChatMessage> SaveMessageAsync(Guid sessionId, MessageRole role, string content)
    {
        var msg = new AiChatMessage
        {
            SessionId = sessionId,
            Role = role,
            Content = content
        };
        _db.AiChatMessages.Add(msg);

        var session = await _db.AiChatSessions.FindAsync(sessionId);
        if (session != null) session.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return msg;
    }

    public async IAsyncEnumerable<string> StreamChatAsync(
        Guid sessionId,
        string userMessage,
        string? contextSnapshot = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var session = await _db.AiChatSessions
            .Include(s => s.AiProvider)
            .FirstOrDefaultAsync(s => s.Id == sessionId, ct)
            ?? throw new InvalidOperationException("Session not found");

        var provider = session.AiProvider!;

        // Save user message
        await SaveMessageAsync(sessionId, MessageRole.User, userMessage);

        // Build messages array
        var messages = new List<object>();
        if (!string.IsNullOrEmpty(session.SystemPrompt))
            messages.Add(new { role = "system", content = session.SystemPrompt });

        var history = await _db.AiChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new { role = m.Role == MessageRole.User ? "user" : "assistant", content = m.Content })
            .ToListAsync(ct);

        messages.AddRange(history);

        // Build API request based on provider type
        var (endpoint, apiKey) = GetEndpointAndKey(provider);
        var client = _httpFactory.CreateClient();

        var requestBody = BuildRequestBody(provider, messages, contextSnapshot);
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json")
        };

        if (!string.IsNullOrEmpty(apiKey))
            request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await client.SendAsync(request,
            HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);

        var fullResponse = new StringBuilder();
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync(ct);
            if (string.IsNullOrEmpty(line)) continue;

            // SSE format: data: {...}
            if (line.StartsWith("data: "))
            {
                var data = line[6..];
                if (data == "[DONE]") break;

                var content = ExtractContent(data, provider.ProviderType);
                if (!string.IsNullOrEmpty(content))
                {
                    fullResponse.Append(content);
                    yield return content;
                }
            }
            // Some providers return plain JSON lines
            else if (line.StartsWith('{'))
            {
                var content = ExtractContent(line, provider.ProviderType);
                if (!string.IsNullOrEmpty(content))
                {
                    fullResponse.Append(content);
                    yield return content;
                }
            }
        }

        // Save assistant response
        await SaveMessageAsync(sessionId, MessageRole.Assistant, fullResponse.ToString());
    }

    public async Task<bool> HealthCheckAsync(AiProvider provider)
    {
        try
        {
            var (endpoint, apiKey) = GetEndpointAndKey(provider);
            var client = _httpFactory.CreateClient();
            var request = new HttpRequestMessage(HttpMethod.Get, endpoint.Replace("/chat/completions", "/models"));
            if (!string.IsNullOrEmpty(apiKey))
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
            var response = await client.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private (string endpoint, string? apiKey) GetEndpointAndKey(AiProvider provider)
    {
        var apiKey = !string.IsNullOrEmpty(provider.EncryptedApiKey)
            ? _encryption.Decrypt(provider.EncryptedApiKey)
            : null;

        var endpoint = provider.ProviderType switch
        {
            ProviderType.OpenAI => "https://api.openai.com/v1/chat/completions",
            ProviderType.Anthropic => "https://api.anthropic.com/v1/messages",
            ProviderType.Ollama => provider.Endpoint ?? "http://localhost:11434/v1/chat/completions",
            ProviderType.Custom => provider.Endpoint ?? throw new InvalidOperationException("Custom provider needs endpoint"),
            _ => throw new ArgumentOutOfRangeException()
        };

        return (endpoint, apiKey);
    }

    private string BuildRequestBody(AiProvider provider, List<object> messages, string? context)
    {
        // Inject context as system message if available
        if (!string.IsNullOrEmpty(context))
        {
            messages.Insert(0, new { role = "system", content = $"Server context:\n{context}" });
        }

        if (provider.ProviderType == ProviderType.Anthropic)
        {
            // Anthropic API format
            var systemMsg = messages.FirstOrDefault(m =>
            {
                var role = ((dynamic)m).role;
                return role == "system";
            });
            var nonSystem = messages.Where(m =>
            {
                var role = ((dynamic)m).role;
                return role != "system";
            }).ToList();

            return JsonSerializer.Serialize(new
            {
                model = provider.DefaultModel,
                max_tokens = provider.MaxTokens,
                messages = nonSystem,
                stream = true,
                system = systemMsg != null ? ((dynamic)systemMsg).content : null
            });
        }

        // OpenAI-compatible format (OpenAI, Ollama, Custom)
        return JsonSerializer.Serialize(new
        {
            model = provider.DefaultModel,
            messages,
            temperature = provider.Temperature,
            max_tokens = provider.MaxTokens,
            stream = true
        });
    }

    private string? ExtractContent(string data, ProviderType type)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;

            if (type == ProviderType.Anthropic)
            {
                if (root.TryGetProperty("type", out var t) && t.GetString() == "content_block_delta")
                {
                    if (root.TryGetProperty("delta", out var delta) &&
                        delta.TryGetProperty("text", out var text))
                        return text.GetString();
                }
            }

            // OpenAI-compatible
            if (root.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0)
            {
                var choice = choices[0];
                if (choice.TryGetProperty("delta", out var delta) &&
                    delta.TryGetProperty("content", out var content))
                    return content.GetString();
            }
        }
        catch { }
        return null;
    }
}
