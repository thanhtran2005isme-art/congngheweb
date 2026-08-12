using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Customer.Migrations
{
    /// <inheritdoc />
    public partial class AddChatTables : Migration
    {
        // Migration nay chi them 2 bang chat: CuocHoiThoai + TinNhan.
        // (Cac bang/cot khac da ton tai trong DB that, duoc dong bo qua BACKEND/Database/KaitoKid_Database.sql,
        //  nen khong dua vao day de tranh tao trung khi chay database update.)

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CuocHoiThoai",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId = table.Column<int>(type: "int", nullable: true),
                    MaKhachVangLai = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    TenHienThi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TrangThai = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    NhanVienId = table.Column<int>(type: "int", nullable: true),
                    SanPhamNguCanhId = table.Column<int>(type: "int", nullable: true),
                    TinNhanCuoi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ThoiGianTinCuoi = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SoTinChuaDocKhach = table.Column<int>(type: "int", nullable: false),
                    SoTinChuaDocNV = table.Column<int>(type: "int", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NgayCapNhat = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CuocHoiThoai", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TinNhan",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CuocHoiThoaiId = table.Column<int>(type: "int", nullable: false),
                    LoaiNguoiGui = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NguoiGuiId = table.Column<int>(type: "int", nullable: true),
                    NoiDung = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LoaiDinhKem = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DinhKemId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DinhKemJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DaDoc = table.Column<bool>(type: "bit", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TinNhan", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TinNhan_CuocHoiThoai_CuocHoiThoaiId",
                        column: x => x.CuocHoiThoaiId,
                        principalTable: "CuocHoiThoai",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CuocHoiThoai_MaKhachVangLai",
                table: "CuocHoiThoai",
                column: "MaKhachVangLai");

            migrationBuilder.CreateIndex(
                name: "IX_CuocHoiThoai_NguoiDungId",
                table: "CuocHoiThoai",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_CuocHoiThoai_TrangThai_ThoiGianTinCuoi",
                table: "CuocHoiThoai",
                columns: new[] { "TrangThai", "ThoiGianTinCuoi" });

            migrationBuilder.CreateIndex(
                name: "IX_TinNhan_CuocHoiThoaiId_Id",
                table: "TinNhan",
                columns: new[] { "CuocHoiThoaiId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TinNhan");

            migrationBuilder.DropTable(
                name: "CuocHoiThoai");
        }
    }
}
