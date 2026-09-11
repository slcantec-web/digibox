import worker from '../../worker/index';

// Cloudflare Pages Functions adapter
// Explicitly handles all /api/* requests and forwards them to the worker API logic
export const onRequest = async (context: {
  request: Request;
  env: any;
  next: () => Promise<Response>;
}): Promise<Response> => {
  return worker.fetch(context.request, context.env, context);
};
