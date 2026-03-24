export function httpResponse(status: number, body: any) {
    return {
        status,
        jsonBody: body
    };
}
