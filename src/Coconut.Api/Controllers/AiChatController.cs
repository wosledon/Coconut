using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Coconut.Api.Data;
using Coconut.Api.Models;
using Coconut.Api.Services;

namespace Coconut.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiChatController : ControllerBase
{
    private readonly AiService _aiService;
    private readonly CoconutDbContext _db;

    public AiChatController(AiService aiService, CoconutDbContext db)
    {
        _aiService = aiService;
        _db = db;
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<List<AiChatSession>>> GetSessions()
    {
        return await _aiService.GetSessionsAsync();
    }

    [HttpPost("sessions")]
    public async Task<ActionResult<AiChatSession>> CreateSession([FromBody] CreateSessionRequest request)
    {
        var session = await _aiService.CreateSessionAsync(
            request.Title, request.ProviderId, request.ConnectionId, request.SystemPrompt);
        return CreatedAtAction(nameof(GetSessions), session);
    }

    [HttpGet("sessions/{sessionId:guid}/messages")]
    public async Task<ActionResult<List<AiChatMessage>>> GetMessages(Guid sessionId)
    {
        return await _aiService.GetMessagesAsync(sessionId);
    }

    [HttpDelete("sessions/{sessionId:guid}")]
    public async Task<IActionResult> DeleteSession(Guid sessionId)
    {
        var session = await _db.AiChatSessions.FindAsync(sessionId);
        if (session is null) return NotFound();

        _db.AiChatSessions.Remove(session);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// SSE streaming chat endpoint. Client receives Server-Sent Events.
    /// </summary>
    [HttpPost("sessions/{sessionId:guid}/stream")]
    public async Task StreamChat(Guid sessionId, [FromBody] StreamChatRequest request, CancellationToken ct)
    {
        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        try
        {
            await foreach (var chunk in _aiService.StreamChatAsync(sessionId, request.Message, request.Context, ct))
            {
                var data = JsonSerializer.Serialize(new { content = chunk });
                await Response.WriteAsync($"data: {data}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }

            await Response.WriteAsync("data: [DONE]\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected
        }
        catch (Exception ex)
        {
            var error = JsonSerializer.Serialize(new { error = ex.Message });
            await Response.WriteAsync($"data: {error}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
    }
}

public record CreateSessionRequest(string Title, Guid ProviderId, Guid? ConnectionId, string? SystemPrompt);
public record StreamChatRequest(string Message, string? Context);
