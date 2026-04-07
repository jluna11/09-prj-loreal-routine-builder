export default {
  async fetch(request, env) {
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "content-type": "application/json",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    // Optional Worker auth token check for extra protection.
    const authHeader = request.headers.get("authorization") || "";
    const expectedToken = env.WORKER_TOKEN || "";
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    try {
      const body = await request.json();
      const messages = body.messages || [];
      const model = body.model || "gpt-4o";
      const temperature = body.temperature ?? 0.7;

      const openAIResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
          }),
        },
      );

      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.json();
        return new Response(
          JSON.stringify({
            error: errorData?.error?.message || "OpenAI request failed",
          }),
          {
            status: openAIResponse.status,
            headers: CORS_HEADERS,
          },
        );
      }

      const data = await openAIResponse.json();
      const reply = data?.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid request or server error" }),
        {
          status: 500,
          headers: CORS_HEADERS,
        },
      );
    }
  },
};
