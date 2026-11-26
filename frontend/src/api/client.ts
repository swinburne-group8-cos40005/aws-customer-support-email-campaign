/** Compatibility exports. All HTTP requests now use the shared client. */
export {
  ApiError,
  ApiRequestError,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiRequest,
  getApiBaseUrl,
} from "@/lib/api"
