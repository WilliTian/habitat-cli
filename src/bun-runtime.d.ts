declare namespace Bun {
  type ServeOptions = {
    hostname?: string;
    port?: number;
    fetch: (request: Request) => Response | Promise<Response>;
  };

  type Server = {
    hostname: string;
    port: number;
    stop(closeActiveConnections?: boolean): void;
  };

  function serve(options: ServeOptions): Server;
}
