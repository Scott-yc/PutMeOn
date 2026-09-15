using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PutMeOn.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ApplicationReadReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Viewed",
                table: "Applications",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Viewed",
                table: "Applications");
        }
    }
}
