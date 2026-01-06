import { getSetting } from "./settings";

export const validateApiKey = (request: Request): boolean => {
    const { searchParams } = new URL(request.url);
    const queryKey = searchParams.get("apiKey");
    const headerKey = request.headers.get("x-api-key");
    const authorization = request.headers.get("authorization");

    const providedKey = queryKey || headerKey || (authorization?.startsWith("Bearer ") ? authorization.split(" ")[1] : null);

    if (!providedKey) return false;

    const storedKey = getSetting("API_KEY");

    // If no key is configured in the system, deny access by default to be safe, 
    // or allow? The user specifically asked to "enable" API key. 
    // If feature isn't used, we shouldn't block public access if that was the old behavior?
    // Wait, the request is "Kan vi nu göra så applikationen har api nyckel".
    // This implies locking it down. So if NO key is set, maybe we should block or allow?
    // Usually if a user hasn't generated a key yet, they can't use the API. 
    // So if storedKey is missing, validation fails.
    if (!storedKey) return false;

    return providedKey === storedKey;
};
