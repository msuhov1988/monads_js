# Monads for handling effects, state, errors and missing values.

### Several monads are implemented in pure JavaScript for:

- Error handling (Either/Success/Fail)
- Working with missing values (Maybe/Just/Nothing)
- Controlled effects (Effect)
- Stateful computations (State)

### Features:

- Pure and lazy style (for example, effects and state are not evaluated until `run` or `runAsync` is called).
- Uniform interface for simple monads for easy mixing of types in a single chain (Either, Maybe and their descendants).
- Ability to “unwrap” simple monads via Effect.
- Support for both synchronous and asynchronous chains (`map, chain` and `mapAsync, chainAsync`) in lazy monads.
- Applicative operations `ap` for simple monads.
- Custom error type (`MonadError`).

### Main classes:

- `Monad`: base abstract class, defines the interface: `of, chain, map, fold`.
- `SMonad`: simple container (Either, Maybe), can be mixed in a single processing chain.
- `LMonad`: lazy containers — Effect (side effects) and State (stateful computations).

## Simple monads: Either, Maybe

### Either (Success/Fail)

Used for error or result handling:
- Success(value) — successful value
- Fail(error) — error

Main methods for Success/Fail::
- `chain(f)`: expects a function returning an SMonad
- `map(f)`: expects a function returning a non-monadic value
- `fold(onSuccess, onFail)`: folds to a value
- `ap(otherSMonad)`: applies the function in the container to a value wrapped in another SMonad
- `getOrElse(def)`: the value if Success, or def (for Fail)
- `result()`: gets the value or throws (for Fail)
- Additional recovery methods for Fail: `onFailMap, onFailChain`
- For interface unification with Maybe (ignored here):  `onNothingMap, onNothingChain` 
- For identification: `isRight(), isHalt(), isSuccess(), isFail()`
- For unification with Maybe(return false here): `isJust(), isNothing()`
- Either can be created with `Either.try(fn)`: wraps a synchronous function, always returns Success or Fail.
- Violating the contract of methods like `chain`, `map`, or `ap` throws a `MonadError`.

### Maybe (Just/Nothing)

Used for working with missing values:
- Just(value) — value is present
- Nothing() — value is absent

Main methods for Just/Nothing are the same as Success/Fail:
- `chain, map, fold, ap, getOrElse, result`
- For recovery from Nothing: `onNothingMap, onNothingChain`
- For unification with recovery methods in Either (ignored here): `onFailMap, onFailChain`
- For identification: `isRight(), isHalt(), isJust(), isNothing()`
- For unification with Either(return false here): `isSuccess(), isFail()`

You can turn a value into Maybe via `Maybe.fromNullable(val, [isNullPredicate])`:
- `null` and `undefined` are always considered empty
- Predicate allows fine-tuning of what else should be considered empty
- Violating the contract of methods like `chain`, `map`, or `ap` throws a `MonadError`.

## Lazy Monads: Effect and State

### Effect (IO/Async)

- Wraps side-effecting functions (like () => someEffect) — does not run immediately
- Invoked via `run()` (for sync) or `runAsync()` (for async chains).
- Supports `chain, chainAsync, map, mapAsync`.
- Throws `MonadError` on contract violation.

Features:
- In chains, you can return not only simple values but also simple monads (Success/Fail/Just/Nothing).
- Effect will automatically unwrap a simple monad: if the function inside returns, e.g., Success(x) or Just(x), you don’t get nested monads in the chain (see test.html).
- fold({onRight, onHalt, onValue}): divides handling for SMonads and regular values..
- ASYNC: supports `mapAsync, chainAsync, foldAsync, runAsync`. Throws `MonadError` if you try to call sync methods on an async chain.

#### Example:
```
const eff = Effect.of(() => Success.of(5))
.map(x => Just.of(x + 3))
.chain(x => Effect.of(() => x * 2));
console.log(eff.run()); // 16
```

### State

A monadic container for computations with hidden state.

- Holds a function: state0 => [value, state1]
- Main methods: `chain, chainAsync, map, mapAsync, fold, foldAsync, run, runAsync`
- Methods `mapIter, chainIter, runIter` let you build large chains and execute them with a simple loop.
- IMPORTANT: mapIter, chainIter do not return new monads but mutate the current one in place!
- BUT this ...Iter mutability is strictly restricted to the current instance. When the standard (classic) methods are called, the structure itself is not duplicated or propagated to new monad instances.

Example:
```
const st = State.pure(0)
.map(x => x + 1)
.chain(x => State.of(s => [x + 2, s * 10]))
const [v, newState] = st.run(1); // v === 3, newState === 10
```

## Unified interface for simple monads

- All simple monads have the same interface (map, chain, ap, fold, getOrElse, the onFail*/onNothing* methods, is* identifiers)
- Therefore, they can be combined freely in one chain.

Example:
```
Maybe.fromNullable(someValue)
.map(x => x * 2)
.onNothingChain(() => Success.of(100)) // Switch from Maybe to Either
.onFailChain(err => Just.of(123)) // Reverse
```


## Mixing Effect and simple monads

Effect can work with any simple monadic container:

If the function inside Effect returns a Success, Fail, Just, or Nothing, the chain will automatically unwrap the inner value. The resulting value enters the fold/chain/map as a regular value.

Tests show chains like: Effect -> map(Success/Just/Fail) -> chain(Effect from Just), etc.

Example:
```
const eff = Effect.of(() => 0)
.map(x => Success.of(x + 1))
.chain(x => Effect.of(_ => Nothing.of()))
.map(x => x + 10);
const result = eff.run();
```


### Any incorrect use of methods (for example, if map returns a monad instead of a value) will throw a MonadError.
### Some methods throw if misused (for example, calling result() on Fail/Nothing).


## Usage

Module import:
```
import { Monad, MonadError, Either, Success, Fail, Maybe, Just, Nothing, Effect, State } from "monads.js";
```

Without modules:
```
<script src="monads_no_module.js"></script>
...
const { Monad, MonadError, Either, Success, Fail, Maybe, Just, Nothing, Effect, State } = Monads;
```