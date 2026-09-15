using System.ComponentModel.DataAnnotations;
namespace PutMeOn.Api.Application;

public sealed record SendCodeRequest([property: Required, EmailAddress, MaxLength(254)] string Email);
public sealed record VerifyCodeRequest([property: Required, EmailAddress, MaxLength(254)] string Email, [property: Required, RegularExpression("^[0-9]{6}$")] string Code);
public sealed record ProfileRequest([property: Required, MaxLength(80)] string Name, [property: Required, MaxLength(20)] string Phone, [property: Required, MaxLength(80)] string Trade, [property: Required, MaxLength(80)] string Location, [property: MaxLength(120)] string? CompanyName);
public sealed record PostRequest([property: Required] string Kind, [property: Required] string Trade, [property: Required, MaxLength(80)] string Location, [property: MaxLength(120)] string? CompanyName, decimal Rate, [property: Required] string From, [property: Required] string To, [property: Required, MaxLength(500)] string Description, int? Revision);
public sealed class ApiError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed record ViewedInterestsRequest([property: Required] string[] ApplicantIds);
