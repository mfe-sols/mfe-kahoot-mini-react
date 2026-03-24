declare module "@tanstack/query-core" {
  export type QueryKey = readonly unknown[];

  export type QueryFunction<TData> = () => Promise<TData>;

  export type QueryOptions<TData> = {
    queryKey: QueryKey;
    queryFn: QueryFunction<TData>;
    staleTime?: number;
    gcTime?: number;
  };

  export type QueryClientConfig = {
    defaultOptions?: {
      queries?: {
        staleTime?: number;
        gcTime?: number;
        retry?: number | boolean;
        refetchOnWindowFocus?: boolean;
      };
    };
  };

  export class QueryClient {
    constructor(config?: QueryClientConfig);
    fetchQuery<TData>(options: QueryOptions<TData>): Promise<TData>;
    removeQueries(options?: { queryKey?: QueryKey }): void;
  }
}
