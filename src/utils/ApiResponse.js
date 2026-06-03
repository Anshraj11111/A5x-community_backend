export class ApiResponse {
  static success(res, data, message, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data,
      message,
    });
  }

  static paginated(res, data, pagination, message) {
    return res.status(200).json({
      success: true,
      data,
      pagination,
      message,
    });
  }

  static created(res, data, message = 'Created successfully') {
    return res.status(201).json({
      success: true,
      data,
      message,
    });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}
