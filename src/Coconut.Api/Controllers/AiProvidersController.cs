using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Coconut.Api.Data;
using Coconut.Api.Models;
using Coconut.Api.Services;

namespace Coconut.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiProvidersController : ControllerBase
{
    private readonly CoconutDbContext _db;
    private readonly EncryptionService _encryption;
    private readonly AiService _aiService;

    public AiProvidersController(CoconutDbContext db, EncryptionService encryption, AiService aiService)
    {
        _db = db;
        _encryption = encryption;
        _aiService = aiService;
    }

    [HttpGet]
    public async Task<ActionResult<List<AiProvider>>> GetAll()
    {
        return await _db.AiProviders.ToListAsync();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AiProvider>> Get(Guid id)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        return provider is null ? NotFound() : provider;
    }

    [HttpPost]
    public async Task<ActionResult<AiProvider>> Create([FromBody] CreateProviderRequest request)
    {
        var provider = new AiProvider
        {
            Name = request.Name,
            ProviderType = request.ProviderType,
            Endpoint = request.Endpoint,
            DefaultModel = request.DefaultModel,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            IsEnabled = true
        };

        if (!string.IsNullOrEmpty(request.ApiKey))
            provider.EncryptedApiKey = _encryption.Encrypt(request.ApiKey);

        _db.AiProviders.Add(provider);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = provider.Id }, provider);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProviderRequest request)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        if (provider is null) return NotFound();

        provider.Name = request.Name ?? provider.Name;
        provider.ProviderType = request.ProviderType ?? provider.ProviderType;
        provider.Endpoint = request.Endpoint ?? provider.Endpoint;
        provider.DefaultModel = request.DefaultModel ?? provider.DefaultModel;
        provider.Temperature = request.Temperature ?? provider.Temperature;
        provider.MaxTokens = request.MaxTokens ?? provider.MaxTokens;
        provider.IsEnabled = request.IsEnabled ?? provider.IsEnabled;
        provider.IsDefault = request.IsDefault ?? provider.IsDefault;

        if (request.ApiKey is not null)
            provider.EncryptedApiKey = _encryption.Encrypt(request.ApiKey);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        if (provider is null) return NotFound();

        _db.AiProviders.Remove(provider);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/health")]
    public async Task<ActionResult<object>> HealthCheck(Guid id)
    {
        var provider = await _db.AiProviders.FindAsync(id);
        if (provider is null) return NotFound();

        var healthy = await _aiService.HealthCheckAsync(provider);
        provider.IsHealthy = healthy;
        provider.LastHealthCheckAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new { healthy };
    }
}

public record CreateProviderRequest(string Name, ProviderType ProviderType, string? Endpoint,
    string? ApiKey, string DefaultModel, double Temperature = 0.7, int MaxTokens = 4096);

public record UpdateProviderRequest(string? Name, ProviderType? ProviderType, string? Endpoint,
    string? ApiKey, string? DefaultModel, double? Temperature, int? MaxTokens,
    bool? IsEnabled, bool? IsDefault);
