export interface ProxyHandler {
    canHandle(path: string): boolean;
    handleRequest(path: string, method: string, body: any, headers: any, query: Record<string, string>): Promise<any>;
}
