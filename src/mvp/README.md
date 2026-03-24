# MVP Structure

Folders:
- `model/` data contracts + defaults
- `presenter/` view-model mapping
- `usecase/` domain logic (formatting, validation, rules)
- `service/` integrations (API, storage, side effects)
- `view/` pure UI (React)

Simple example:
```ts
// usecase
export const formatTitle = (title: string) => title.trim();

// presenter
title: formatTitle(model.title);
```

Service example:
```ts
// service
export const fetchSummary = async () =>
  Promise.resolve({ title: "Hello", headings: ["One", "Two"] });

// presenter
const summary = await fetchSummary();
```

React Query example:
```ts
// service
export const fetchSummary = async () =>
  Promise.resolve({ title: "Hello", headings: ["One", "Two"] });

// presenter (hook)
const { data } = useQuery({
  queryKey: summaryQueryKey,
  queryFn: fetchSummary,
});
```

Query keys:
```ts
export const summaryQueryKey = ["summary"] as const;
```
