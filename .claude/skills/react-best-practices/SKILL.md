# React Best Practices Skill

Vercel's official React and Next.js performance optimization guidelines. 65 rules across 8 priority categories.

## When to Apply

- Writing new React components or pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React code
- Optimizing bundle size or load times

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### Eliminating Waterfalls (CRITICAL)

- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-after-nonblocking` - Use after() for non-blocking operations

### Re-render Optimization (MEDIUM)

- `rerender-memo` - Extract expensive work into memoized components
- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-use-ref-transient-values` - Use refs for frequent values
- `rerender-move-effect-to-event` - Put interaction logic in handlers
- `rerender-start-transition` - Use startTransition for non-urgent updates

### Rendering Performance (MEDIUM)

- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading

### JavaScript Performance (LOW-MEDIUM)

- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-early-exit` - Return early from functions
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-request-idle-callback` - Defer non-critical work to idle time

## Example Rules

### async-parallel

**Problem:**
```typescript
// BAD - Sequential requests cause waterfall
const user = await fetchUser(id);
const posts = await fetchPosts(id);
```

**Solution:**
```typescript
// GOOD - Parallel requests
const [user, posts] = await Promise.all([
  fetchUser(id),
  fetchPosts(id)
]);
```

### bundle-dynamic-imports

**Problem:**
```typescript
// BAD - Heavy chart loaded on initial page load
import { HeavyChart } from './HeavyChart';
```

**Solution:**
```typescript
// GOOD - Dynamic import only when needed
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton />
});
```

### rerender-memo

**Problem:**
```typescript
// BAD - Expensive calculation on every render
function ProductList({ items }) {
  const sorted = items.sort((a, b) => b.price - a.price);
  // ...
}
```

**Solution:**
```typescript
// GOOD - Memoize expensive computation
const sorted = useMemo(
  () => items.sort((a, b) => b.price - a.price),
  [items]
);
```

## Full Documentation

For complete rule implementations with code examples, see `rules/` directory.
