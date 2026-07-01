namespace Coconut.Api.Models;

public class SshConnection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 22;
    public string UserName { get; set; } = string.Empty;
    public AuthType AuthType { get; set; } = AuthType.Password;
    public string? EncryptedPassword { get; set; }
    public string? KeyFilePath { get; set; }
    public string? KeyFingerprint { get; set; }
    public string? GroupName { get; set; }
    public string? Tags { get; set; } // JSON array
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AiProvider
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public ProviderType ProviderType { get; set; }
    public string? Endpoint { get; set; }
    public string? EncryptedApiKey { get; set; }
    public string DefaultModel { get; set; } = string.Empty;
    public double Temperature { get; set; } = 0.7;
    public int MaxTokens { get; set; } = 4096;
    public bool IsEnabled { get; set; } = true;
    public bool IsDefault { get; set; }
    public DateTime? LastHealthCheckAt { get; set; }
    public bool IsHealthy { get; set; }
}

public class AiChatSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public Guid AiProviderId { get; set; }
    public Guid? SshConnectionId { get; set; }
    public string? SystemPrompt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public AiProvider? AiProvider { get; set; }
    public SshConnection? SshConnection { get; set; }
    public List<AiChatMessage> Messages { get; set; } = [];
}

public class AiChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public MessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ContextSnapshot { get; set; } // JSON
    public string? SuggestedCommands { get; set; } // JSON array
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AiChatSession? Session { get; set; }
}

public class AppSettings
{
    public int Id { get; set; } = 1;

    // General
    public string Theme { get; set; } = "dark";
    public string Language { get; set; } = "zh-CN";
    public bool AutoConnectLast { get; set; } = true;

    // Terminal
    public int FontSize { get; set; } = 14;
    public string FontFamily { get; set; } = "JetBrains Mono";
    public string CursorStyle { get; set; } = "block";
    public int ScrollbackLines { get; set; } = 5000;

    // SSH
    public int DefaultPort { get; set; } = 22;
    public int ConnectionTimeout { get; set; } = 30;
    public int KeepAliveInterval { get; set; } = 60;
    public bool AutoReconnect { get; set; }

    // Data
    public string? DatabasePath { get; set; }
}
