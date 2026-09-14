namespace PutMeOn.Api.Domain;

public sealed class Account
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Trade { get; set; } = "";
    public string Location { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public long CreatedAt
    {
        get; set;
    }
}
public sealed class JobPost
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OwnerId { get; set; } = "";
    public string Kind { get; set; } = "looking";
    public string Trade { get; set; } = "";
    public string Location { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public decimal Rate
    {
        get; set;
    }
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public string Description { get; set; } = "";
    public long CreatedAt
    {
        get; set;
    }
    public long ExpiresAt
    {
        get; set;
    }
    public int Revision { get; set; } = 1;
    public Account Owner { get; set; } = null!;
    public List<ApplicationEntry> Applications { get; set; } = [];
}
public sealed class ApplicationEntry
{
    public string PostId { get; set; } = "";
    public string ApplicantId { get; set; } = "";
    public long CreatedAt
    {
        get; set;
    }
    public JobPost Post { get; set; } = null!;
    public Account Applicant { get; set; } = null!;
}
public sealed class LoginCode
{
    public string Email { get; set; } = "";
    public string Hash { get; set; } = "";
    public long ExpiresAt
    {
        get; set;
    }
    public long LastSentAt
    {
        get; set;
    }
    public long WindowStart
    {
        get; set;
    }
    public int SentInWindow
    {
        get; set;
    }
    public int Attempts
    {
        get; set;
    }
    public int Revision
    {
        get; set;
    }
}
public sealed class LoginSession
{
    public string Hash { get; set; } = "";
    public string AccountId { get; set; } = "";
    public long ExpiresAt
    {
        get; set;
    }
    public Account Account { get; set; } = null!;
}
