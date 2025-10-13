using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private static List<Service> _services = new()
    {
        new Service { Id = 1, Name = "PAN Card", Fee = 100, Description = "Apply for new PAN card", Category = "Document" },
        new Service { Id = 2, Name = "Aadhar Card", Fee = 50, Description = "Aadhar card services", Category = "Document" },
        new Service { Id = 3, Name = "Passport", Fee = 1500, Description = "Passport services", Category = "Travel" },
        new Service { Id = 4, Name = "Voter ID", Fee = 25, Description = "Voter ID services", Category = "Document" },
        new Service { Id = 5, Name = "Driving License", Fee = 200, Description = "Driving license services", Category = "License" }
    };

    private static List<Application> _applications = new();
    private static int _nextAppId = 1;

    [HttpGet("services")]
    public IActionResult GetServices() => Ok(_services);

    [HttpPost("applications")]
    public IActionResult CreateApplication([FromBody] ApplicationRequest request)
    {
        var application = new Application
        {
            Id = _nextAppId++,
            CustomerName = request.CustomerName,
            Phone = request.Phone,
            Email = request.Email,
            ServiceId = request.ServiceId,
            Status = "Pending",
            ApplicationDate = DateTime.Now
        };

        _applications.Add(application);
        return Ok(new { message = "Application submitted!", applicationId = application.Id });
    }

    [HttpGet("applications")]
    public IActionResult GetApplications() => Ok(_applications);

    [HttpPut("applications/{id}/status")]
    public IActionResult UpdateStatus(int id, [FromBody] StatusRequest request)
    {
        var app = _applications.Find(a => a.Id == id);
        if (app != null) app.Status = request.Status;
        return Ok(new { message = "Status updated!" });
    }
}

public class Service
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Fee { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

public class Application
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int ServiceId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime ApplicationDate { get; set; }
}

public class ApplicationRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int ServiceId { get; set; }
}

public class StatusRequest
{
    public string Status { get; set; } = string.Empty;
}