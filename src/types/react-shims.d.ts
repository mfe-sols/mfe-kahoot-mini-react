declare module "react" {
  export type SetStateAction<T> = T | ((prevState: T) => T);
  export type Dispatch<A> = (value: A) => void;
  export type CSSProperties = Record<string, string | number | undefined>;

  export const useEffect: (...args: unknown[]) => void;
  export const useMemo: <T>(factory: () => T, deps?: unknown[]) => T;
  export const useRef: <T>(value: T) => { current: T };
  export const useState: <T>(init: T | (() => T)) => [T, Dispatch<SetStateAction<T>>];
  export const useCallback: <T extends (...args: any[]) => any>(fn: T, deps?: unknown[]) => T;
  export const useId: () => string;
}

declare module "react-dom/client" {
  export const createRoot: (el: Element) => { render: (node: unknown) => void };
}

declare module "single-spa-react" {
  const singleSpaReact: (opts: Record<string, unknown>) => {
    bootstrap: (...args: unknown[]) => Promise<unknown>;
    mount: (...args: unknown[]) => Promise<unknown>;
    unmount: (...args: unknown[]) => Promise<unknown>;
  };
  export default singleSpaReact;
}

declare module "@tanstack/react-query" {
  export type UseQueryResult<TData> = {
    data?: TData;
    isLoading: boolean;
    isError: boolean;
    refetch: () => Promise<unknown>;
  };
  export const useQuery: <TData>(opts: {
    queryKey: readonly unknown[];
    queryFn: () => Promise<TData>;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
  }) => UseQueryResult<TData>;
  export const QueryClientProvider: (props: {
    client: unknown;
    children?: unknown;
  }) => any;
}

declare const process: {
  env: {
    API_BASE_URL?: string;
    AUTH_BASE_URL?: string;
  };
};
