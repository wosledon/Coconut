using Microsoft.AspNetCore.Mvc;
using Coconut.Api.Services;

namespace Coconut.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SftpController : ControllerBase
{
    private readonly SftpService _sftpService;

    public SftpController(SftpService sftpService)
    {
        _sftpService = sftpService;
    }

    [HttpGet("{connectionId:guid}/list")]
    public ActionResult<List<SftpFileInfo>> ListFiles(Guid connectionId, [FromQuery] string path = "/")
    {
        try
        {
            var files = _sftpService.ListDirectory(connectionId, path);
            return Ok(files);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{connectionId:guid}/upload")]
    public IActionResult Upload(Guid connectionId, [FromQuery] string path, IFormFile file)
    {
        try
        {
            using var stream = file.OpenReadStream();
            _sftpService.UploadFile(connectionId, path, stream);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{connectionId:guid}/download")]
    public IActionResult Download(Guid connectionId, [FromQuery] string path)
    {
        try
        {
            var stream = _sftpService.DownloadFile(connectionId, path);
            var fileName = System.IO.Path.GetFileName(path);
            return File(stream, "application/octet-stream", fileName);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{connectionId:guid}/file")]
    public IActionResult Delete(Guid connectionId, [FromQuery] string path)
    {
        try
        {
            _sftpService.DeleteFile(connectionId, path);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{connectionId:guid}/rename")]
    public IActionResult Rename(Guid connectionId, [FromBody] RenameRequest request)
    {
        try
        {
            _sftpService.RenameFile(connectionId, request.OldPath, request.NewPath);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{connectionId:guid}/mkdir")]
    public IActionResult CreateDirectory(Guid connectionId, [FromQuery] string path)
    {
        try
        {
            _sftpService.CreateDirectory(connectionId, path);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public record RenameRequest(string OldPath, string NewPath);
