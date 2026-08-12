namespace Shared.Exceptions;

/// <summary>
/// Exception cơ bản cho business logic errors
/// </summary>
public class AppException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>
/// 404 - Không tìm thấy resource
/// </summary>
public class NotFoundException(string message = "Không tìm thấy dữ liệu")
    : AppException(message, 404);

/// <summary>
/// 401 - Chưa xác thực
/// </summary>
public class UnauthorizedException(string message = "Bạn chưa đăng nhập")
    : AppException(message, 401);

/// <summary>
/// 403 - Không có quyền
/// </summary>
public class ForbiddenException(string message = "Bạn không có quyền thực hiện thao tác này")
    : AppException(message, 403);

/// <summary>
/// 409 - Conflict (duplicate, etc.)
/// </summary>
public class ConflictException(string message = "Dữ liệu đã tồn tại")
    : AppException(message, 409);

/// <summary>
/// 422 - Validation error
/// </summary>
public class ValidationException : AppException
{
    public List<string> Errors { get; }

    public ValidationException(string message, List<string>? errors = null)
        : base(message, 422)
    {
        Errors = errors ?? [];
    }
}
// v1.1: Them NotFoundException va UnauthorizedException
// v1.2: Bo sung ForbiddenException, ConflictException, ValidationException
