namespace Coconut.Api.Models;

public enum AuthType
{
    Password = 0,
    Key = 1,
    Agent = 2
}

public enum ProviderType
{
    OpenAI = 0,
    Anthropic = 1,
    Ollama = 2,
    Custom = 3
}

public enum MessageRole
{
    User = 0,
    Assistant = 1,
    System = 2
}
