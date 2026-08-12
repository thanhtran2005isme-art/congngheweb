using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Shared.Authorization;

// =============================================================
//  PERMISSION-BASED AUTHORIZATION (RBAC granular)
//  Thay cho [Authorize(Roles = "admin")] cứng — cho phép nhân viên
//  truy cập đúng những endpoint mà vai trò của họ được cấp quyền.
//
//  Quy tắc cho phép (theo thứ tự, chỉ cần 1 điều kiện đúng):
//   1. Super admin nhân viên   → claim is_super_admin = "true" (toàn quyền)
//   2. Nhân viên có quyền       → claim "permission" = mã quyền yêu cầu
//
//  LƯU Ý (fix Lỗ hổng 2): KHÔNG bypass theo role "admin" nữa.
//  Trước đây bất kỳ ai mang role "admin" đều vượt qua mọi check, bỏ qua
//  permission chi tiết → quyền chỉ là "trang trí". Nay tài khoản role
//  "admin" vẫn phải có permission claim tương ứng (role admin được seed
//  đầy đủ quyền nên không mất quyền), còn super admin thật mới được bypass.
// =============================================================

/// <summary>Requirement chứa mã quyền cần kiểm tra (vd "orders.view").</summary>
public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

/// <summary>Đánh dấu action/controller yêu cầu một mã quyền cụ thể.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "PERM:";

    public HasPermissionAttribute(string permission) : base($"{PolicyPrefix}{permission}")
    {
    }
}

/// <summary>
/// Handler quyết định cho phép hay không dựa trên claim của JWT.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var user = context.User;

        // 1) Super admin nhân viên → toàn quyền (bypass duy nhất được phép)
        if (user.HasClaim("is_super_admin", "true"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // 2) Nhân viên được cấp đúng mã quyền (kể cả tài khoản role "admin"
        //    — role admin được seed đầy đủ quyền nên vẫn truy cập bình thường)
        if (user.HasClaim("permission", requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

/// <summary>
/// Policy provider động: tự sinh policy cho mọi mã quyền "PERM:xxx"
/// mà không cần khai báo tay từng policy trong Program.cs.
/// Các policy khác (không bắt đầu bằng PERM:) rơi về provider mặc định.
/// </summary>
public sealed class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(HasPermissionAttribute.PolicyPrefix, StringComparison.Ordinal))
        {
            var permission = policyName[HasPermissionAttribute.PolicyPrefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallback.GetPolicyAsync(policyName);
    }
}

/// <summary>Extension đăng ký toàn bộ hạ tầng permission authorization.</summary>
public static class PermissionAuthorizationExtensions
{
    public static IServiceCollection AddPermissionAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization();
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        return services;
    }
}
