"use strict"

const Monads = (function() {

const E_BRAND = Symbol('MonadError');

class MonadError extends Error {
    constructor(message) {
        super(`MonadError: ${message}`);
        this.name = "MonadError";
        this[E_BRAND] = true;
    }
}


const M_BRAND = Symbol('Monad');

class Monad {
    static of() { throw new MonadError("Static Monad.of must be defined in subclass") }

    constructor(value) { this._value = value; this[M_BRAND] = true; }
    
    chain() { throw new MonadError("Monad.chain must be defined in subclass") }

    map() { throw new MonadError("Monad.map must be defined in subclass") }    

    fold() { throw new MonadError("Monad.fold must be defined in subclass") }

    toString() { throw new MonadError("Monad.toString must be defined in subclass") }    
}


const S_BRAND = Symbol('SMonad');
const L_BRAND = Symbol('LMonad');


/**
 * @extends {Monad} simple monads like Either, Maybe.
 */
class SMonad extends Monad {     
    constructor(value) { super(value); this[S_BRAND] = true; }  

    ap() { throw new MonadError("SMonad.ap must be defined in subclass")  }

    isRight() { return false }

    isHalt() { return false }    

    getOrElse() { throw new MonadError("SMonad.getOrElse must be defined in subclass")  }

    result() { throw new MonadError("SMonad.result must be defined in subclass") }    
}


/**
 * @extends {Monad}
 * LMonad - lazy monads like generally accepted IO, State.
 * Here it is - Effect(IO).
 */
class LMonad extends Monad {     
    constructor(value) { super(value); this[L_BRAND] = true; }  

    run() { throw new MonadError("LMonad.run must be defined in subclass") }
    
    static pure() { throw new MonadError("LMonad.pure must be defined in subclass") }
}

const isMonadError = err => Boolean(err && err[E_BRAND]);
const isMonad = v => Boolean(v && v[M_BRAND]);

const isSMonad = v => Boolean(v && v[S_BRAND]);
const isRightSMonad = v => (isSMonad(v) && v.isRight?.());
const isHaltSMonad = v => (isSMonad(v) && v.isHalt?.());
const unwrapSMonad = m => m.result();

const isLMonad = v => Boolean(v && v[L_BRAND]);
const identical = val => val;

/** 
 * @returns {void}
 * @throws {MonadError} - throws if value is Promise. Method for concrete definition.
 */
function panicOnPromise(value, method) {
    if (value instanceof Promise) {
        throw new MonadError(`${method} - inner or outer function must NOT return Promise. Use async analog instead.` )
    }
}

/**
 * @returns {void}
 * @throws {MonadError} - throws if value is not a function. Method for concrete definition.
 */
function panicIfNotFunction(value, method) {
    if (typeof value !== 'function') {
        throw new MonadError(`${method} - requires a function inside.`)
    }
}

/**
 * @returns {void}
 * @throws {MonadError} - throws if value is not SMonad entity. Method for concrete definition.
 */
function panicOnChainViolation(value, method) {
    if (!isSMonad(value)) {
        throw new MonadError(`${method} - improper use, applicable value must be SMonad`)
    }
}

/**
 * @returns {void}
 * @throws {MonadError} - throws if value is Monad entity. Method for concrete definition.
 */
function panicOnMapViolation(value, method) {
    if (isMonad(value)) {
        throw new MonadError(`${method} - improper use, applicable value must NOT be Monad`)
    } 
}

/**
 * @returns {void}
 * @throws {MonadError} - throws if value is LMonad entity. Method for concrete definition.
 */
function panicOnLazyMapViolation(value, method) {
    if (isLMonad(value)) {
        throw new MonadError(`${method} - improper use, applicable value must NOT be LMonad`)
    } 
}

/**
 * NEED FOR apply, call or bind, because has 'this' inside!
 * @returns {void}
 * @throws {MonadError} - throws if value is entity of another class. Method for concrete def.
 */
function panicOnAnotherInstance(value, method) {      
    if (!(value instanceof this.constructor)) {
        throw new MonadError(`${method} - improper use, applicable value must be the same type of LMonad`)
    } 
}

/**
 * NEED FOR apply, call or bind, because has 'this' inside!
 * @returns {void}
 * @throws {MonadError} - throws if value is LMonad, but another class. Method for concrete def.
 */
function panicOnAnotherLazyMonad(value, method) {      
    if (isLMonad(value) && !(value instanceof this.constructor)) {
        throw new MonadError(`${method} - improper use, applicable value must be the SAME type of LMonad or NOT LMonad`)
    } 
}


/**
 * @extends {SMonad} 'Abstract subclass of simple monad(SMonad). But defines "try" method.'
 */
class Either extends SMonad {
    /** 
     * Executes the SYNC function with all errors being caught.
     * @template E 
     * @template V     
     * @param {() => V} testedFunc
     * @returns {Fail<E>|Success<V>}
     * @throws {MonadError} - if result of testedFunc is Promise
     */
    static try(testedFunc) {
        try {
            const result = testedFunc();            
            panicOnPromise(result, 'Either.try');
            return new Success(result)
        } catch(error) { 
            if (isMonadError(error)) { throw error }
            return new Fail(error)
        }
    }

    constructor(value) { super(value) }
}


/**
 * @extends {SMonad} 'Abstract subclass of simple monad(SMonad). But defines "fromNullable" method.'
 */
class Maybe extends SMonad {
    /** 
     * By default, values of null and undefined are treated as nullable. More fine-grained control is possible using the treatAsNull function
     * @template V    
     * @param {V} value 
     * @param {(value: V) => boolean} [treatAsNull]
     * @returns {Nothing|Just<V>}
     */
    static fromNullable(value, treatAsNull=null) {
        if (value === undefined || value === null) { return new Nothing() }
        if (typeof treatAsNull === 'function' && treatAsNull(value)) { return new Nothing() }
        return new Just(value)
    }     

    constructor(value) { super(value) }
}


/** 
 * @template A 
 * @extends {Either}
 */
class Success extends Either {
    /**
     * @param {A} value
     * @returns {Success<A>}     
     */
    static of(value) { return new Success(value) }    

    /** @param {A} value */
    constructor(value) { super(value) } 
    
    /**    
     * @param {function(A): SMonad} func
     * @returns {SMonad}
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    chain(func) {       
        const res = func(this._value);
        panicOnChainViolation(res, 'Success.chain');
        return res        
    }

    /**
     * @template R
     * @param {function(A): R} func
     * @returns {Success<R>}
     * @throws {MonadError} 'Improper use of "map" method - function must NOT return SMonad'
    */
    map(func) {
        const res = func(this._value);        
        panicOnMapViolation(res, 'Success.map');      
        return new Success(res)
    }    

    /**
     * @template E
     * @param {function(E): SMonad} _
     * @returns {Success<A>} An additional method for attempting recovery
    */
    onFailChain(_) { return this }  

    /**
     * @template E
     * @template R
     * @param {function(E): R} _
     * @returns {Success<A>} An additional method for attempting recovery
    */
    onFailMap(_) { return this }  
    
    /**     
     * @param {function(): SMonad} _
     * @returns {Success<A>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onNothingChain(_) { return this }  

    /**     
     * @template R
     * @param {function(): R} _
     * @returns {Success<A>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onNothingMap(_) { return this } 

    /**     
     * Applies a value enclosed in a container to function in the container.
     * Mixing Either and Maybe is possible.
     * Monad of the argument defines monad of the result
     * @param {SMonad} valueContainer
     * @returns {SMonad} 
     * @throws {MonadError} 
     */
    ap(valueContainer) {
        panicIfNotFunction(this._value, 'Success.ap');       
        panicOnChainViolation(valueContainer, 'Success.ap');       
        if(valueContainer.isHalt()) { return valueContainer }                
        const res = this._value(valueContainer._value);               
        return valueContainer.constructor.of(res)  
    }

    /** @returns {true} */
    isRight() { return true }   

    /** @returns {true} for point-by-point introspection */
    isSuccess() { return true }

    /** @returns {false} for point-by-point introspection */
    isFail() { return false }

    /** @returns {false} for point-by-point introspection */
    isJust() { return false }

    /** @returns {false} for point-by-point introspection */
    isNothing() { return false }

    /**
     * @template V
     * @param {V} _
     * @returns {A}
    */
    getOrElse(_) { return this._value }    

    /** @returns {A} */
    result() { return this._value }

    /**
     * @template R1
     * @template R2
     * @template E
     * @param {function(A): R1} onSuccess 
     * @param {function(E): R2} onFail     
     * @returns {R1} 
     */
    fold(onSuccess, onFail) { return onSuccess(this._value) }

    toString() { return `Success(${this._value})` }
}


/** 
 * @template E 
 * @extends {Either}
 */
class Fail extends Either {
    /**
     * @param {E} value
     * @returns {Fail<E>}
     */
    static of(value) { return new Fail(value) }    

    /** @param {E} value */
    constructor(value) { super(value) } 
    
    /**
     * @param {function(*): SMonad} _
     * @returns {Fail<E>}
    */
    chain(_) { return this }

    /**
     * @template R
     * @param {function(*): R} _
     * @returns {Fail<E>}
    */
    map(_) { return this }

    /**
     * @param {function(E): SMonad} func
     * @returns {SMonad} An additional method for attempting recovery.
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    onFailChain(func) {
        const res = func(this._value);
        panicOnChainViolation(res, 'Fail.onFailChain');
        return res
    }

    /**
     * @template E
     * @template R
     * @param {function(E): R} func
     * @returns {Success<R>} An additional method for attempting recovery.
     * @throws {MonadError} 'Improper use of "map" method - function must NOT return SMonad'
    */
    onFailMap(func) {
        const res = func(this._value);
        panicOnMapViolation(res, 'Fail.onFailMap');
        return new Success(res)
    } 
    
    /**     
     * @param {function(): SMonad} _
     * @returns {Fail<E>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onNothingChain(_) { return this } 
    
    /**     
     * @template R
     * @param {function(): R} _
     * @returns {Fail<E>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onNothingMap(_) { return this } 

    /**    
     * @param {SMonad} _
     * @returns {Fail<E>}
     * Applies a value enclosed in a container to a function in the container.     
     */
    ap(_) { return this }   

    /** @returns {true} */
    isHalt() { return true }

    /** @returns {false} for point-by-point introspection */
    isSuccess() { return false } 

    /** @returns {true} for point-by-point introspection */
    isFail() { return true }

    /** @returns {false} for point-by-point introspection */
    isJust() { return false }

    /** @returns {false} for point-by-point introspection */
    isNothing() { return false }

    /** 
     * @template V    
     * @param {V} value
     * @returns {V}
    */
    getOrElse(value) { return value } 

    /** @throws {MonadError} No result inside the Fail container */
    result() { throw new MonadError("Cannot extract result from the Fail container") }

    /**
     * @template A
     * @template R1
     * @template R2
     * @param {function(A): R1} onSuccess 
     * @param {function(E): R2} onFail      
     * @returns {R2} 
     */
    fold(onSuccess, onFail) { return onFail(this._value) }

    toString() { return `Fail(${this._value})` }
}


/** 
 * @template A 
 * @extends {Maybe}
 */
class Just extends Maybe {
    /**
     * @param {A} value
     * @returns {Just<A>}
     */
    static of(value) { return new Just(value) }    

    /** @param {A} value */
    constructor(value) { super(value) } 
    
    /**    
     * @param {function(A): SMonad} func
     * @returns {SMonad}
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    chain(func) {
        const res = func(this._value);        
        panicOnChainViolation(res, 'Just.chain');        
        return res        
    }

    /**
     * @template R
     * @param {function(A): R} func
     * @returns {Just<R>}
     * @throws {MonadError} 'Improper use of "map" method - function must NOT return SMonad'
    */
    map(func) {
        const res = func(this._value);        
        panicOnMapViolation(res, 'Just.map');               
        return new Just(res)
    }

    /**
     * @template E
     * @param {function(E): SMonad} _
     * @returns {Just<A>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onFailChain(_) { return this }  

    /**
     * @template E
     * @template R
     * @param {function(E): R} _
     * @returns {Just<A>} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onFailMap(_) { return this }  
    
    /**     
     * @param {function(): SMonad} _
     * @returns {Just<A>} An additional method for attempting recovery.
    */
    onNothingChain(_) { return this }  

    /**     
     * @template R
     * @param {function(): R} _
     * @returns {Just<A>} An additional method for attempting recovery.
    */
    onNothingMap(_) { return this } 

    /**     
     * Applies a value enclosed in a container to function in the container.
     * Mixing Either and Maybe is possible.
     * Monad of the argument defines monad of the result
     * @param {SMonad} valueContainer
     * @returns {SMonad} 
     * @throws {MonadError} 
     */
    ap(valueContainer) {
        panicIfNotFunction(this._value, 'Just.ap');       
        panicOnChainViolation(valueContainer, 'Just.ap');       
        if(valueContainer.isHalt()) { return valueContainer }                
        const res = this._value(valueContainer._value);               
        return valueContainer.constructor.of(res)  
    }

    /** @returns {true} */
    isRight() { return true }    

    /** @returns {false} for point-by-point introspection */
    isSuccess() { return false }

    /** @returns {false} for point-by-point introspection */
    isFail() { return false }

    /** @returns {true} for point-by-point introspection */
    isJust() { return true }

    /** @returns {false} for point-by-point introspection */
    isNothing() { return false }

    /**
     * @template V
     * @param {V} _
     * @returns {A}
    */
    getOrElse(_) { return this._value }    

    /** @returns {A} */
    result() { return this._value }

    /**
     * @template R1
     * @template R2     
     * @param {function(A): R1} onJust     
     * @param {function(): R2} onNothing 
     * @returns {R1} 
     */
    fold(onJust, onNothing) { return onJust(this._value) }

    toString() { return `Just(${this._value})` }
}


/**  
 * @extends {Maybe}
 */
class Nothing extends Maybe {
    /**     
     * @param {*} _ argument is unnecessary, only for uniformity of interfaces purpose
     * @returns {Nothing}
     */
    static of(_) { return new Nothing() }    
    
    /** @param {*} _ argument is unnecessary, only for uniformity of interfaces purpose */
    constructor(_) { super(undefined) } 
    
    /**
     * @param {function(*): SMonad} _
     * @returns {Nothing}
     */
    chain(_) { return this }

    /**
     * @template R
     * @param {function(*): R} _
     * @returns {Nothing}
     */
    map(_) { return this }

    /**
     * @template E
     * @param {function(E): SMonad} _
     * @returns {Nothing} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onFailChain(_) { return this }

    /**
     * @template E
     * @template R
     * @param {function(E): R} _
     * @returns {Nothing} An additional method for attempting recovery.
     * It's pointless here. Made for uniformity and the ability to mix different monads in one chain
    */
    onFailMap(_) { return this } 
    
    /**     
     * @param {function(): SMonad} func
     * @returns {SMonad} An additional method for attempting recovery.
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    onNothingChain(func) {
        const res = func();
        panicOnChainViolation(res, 'Nothing.onNothingChain');
        return res
    } 
    
    /**     
     * @template R
     * @param {function(): R} func
     * @returns {Just<R>} An additional method for attempting recovery.
     * @throws {MonadError} 'Improper use of "map" method - function must NOT return SMonad'
    */
    onNothingMap(func) {
        const res = func();
        panicOnMapViolation(res, 'Nothing.onNothingMap');
        return new Just(res)
    } 

    /**     
     * @param {SMonad} _
     * @returns {Nothing}
     * Applies a value enclosed in a container to a function in the container.     
     */
    ap(_) { return this }    

    /** @returns {true} */
    isHalt() { return true }

    /** @returns {false} */
    isSuccess() { return false }

    /** @returns {false} */
    isFail() { return false }

    /** @returns {false} */
    isJust() { return false }

    /** @returns {true} */
    isNothing() { return true }

    /** 
     * @template V    
     * @param {V} value
     * @returns {V}
    */
    getOrElse(value) { return value } 

    /** @throws {MonadError} No result inside the Nothing container */
    result() { throw new MonadError("Cannot extract result from the Nothing container") }

    /**
     * @template A
     * @template R1
     * @template R2
     * @param {function(A): R1} onJust     
     * @param {function(): R2} onNothing 
     * @returns {R2} 
     */
    fold(onJust, onNothing) { return onNothing() }

    toString() { return 'Nothing()' }
}


/**
 * @template F
 * @extends {LMonad}
 * Works with functions that return both simple values and instances of simple monads(SMonad).
 * Async functions are possible.
 */
class Effect extends LMonad {
    /**     
     * @param {function(): R} effect
     * @returns {Effect<F>}
     * @throws {MonadError} Effect requires a function 
     */
    static of(effect) {
        panicIfNotFunction(effect, 'static Effect.of'); 
        return new Effect(effect)
    }

    /**     
     * @param {function(): R} effect
     * @throws {MonadError} Effect requires a function 
     */
    constructor(effect) {        
        panicIfNotFunction(effect, 'Effect.constructor');
        super(effect);        
    }

    /**      
     * @param {function(R): Effect<F>} func 
     * @returns {Effect<F>}    
     * @throws {MonadError} 'Improper use of "chain" method'
     */
    chain(func) {        
        /** @type {function(): R} */       
        const effectNew = () => {            
            let out = this._value();
            panicOnPromise(out, 'Effect.chain');
            if (isHaltSMonad(out)) { return out } 
            if (isRightSMonad(out)) { out = unwrapSMonad(out) }                     
            const resultEff = func(out);
            panicOnAnotherInstance.call(this, resultEff, 'Effect.chain');            
            const result = resultEff._value()  
            if (isRightSMonad(result)) { return unwrapSMonad(result) } 
            return result     
        }
        return new Effect(effectNew)
    } 
    
    /**    
     * @param {function(R): Promise<Effect<F>>} asyncFunc
     * @returns {Effect<function(): Promise<R>>}
     * @throws {MonadError} 'Improper use of "chainAsync" method'
     */
    chainAsync(asyncFunc) {        
        /** @type {function(): Promise<R>} */       
        const effectNew = async () => {            
            let out = await this._value();                       
            if (isHaltSMonad(out)) { return out } 
            if (isRightSMonad(out)) { out = unwrapSMonad(out) }             
            const resultEff = await asyncFunc(out); 
            panicOnAnotherInstance.call(this, resultEff, 'Effect.chainAsync'); 
            const result = await resultEff._value();          
            if (isRightSMonad(result)) { return unwrapSMonad(result) } 
            return result     
        }
        return new Effect(effectNew)
    }

    /**       
     * @param {function(R): R} func
     * @returns {Effect<() => R>}
     * @throws {MonadError} 'Improper use of "map" method'
     */
    map(func) {        
        /** @type {function(): R} */
        const effectNew = () => {
            let out = this._value();
            panicOnPromise(out, 'Effect.map');
            if (isHaltSMonad(out)) { return out } 
            if (isRightSMonad(out)) { out = unwrapSMonad(out) }              
            const result = func(out);
            panicOnPromise(result, 'Effect.map');
            panicOnLazyMapViolation(result, 'Effect.map');           
            if (isRightSMonad(result)) { return unwrapSMonad(result) } 
            return result
        }
        return new Effect(effectNew)
    }

    /**      
     * @param {function(R): Promise<R>} asyncFunc
     * @returns {Effect<function(): Promise<R>>}
     * @throws {MonadError} 'Improper use of "mapAsync" method'
     */
    mapAsync(asyncFunc) {        
        /** @type {function(): Promise<R>} */
        const effectNew = async () => {
            let out = await this._value();            
            if (isHaltSMonad(out)) { return out } 
            if (isRightSMonad(out)) { out = unwrapSMonad(out) }             
            const result = await asyncFunc(out);                                         
            panicOnLazyMapViolation(result, 'Effect.mapAsync');
            if (isRightSMonad(result)) { return unwrapSMonad(result) } 
            return result
        }
        return new Effect(effectNew)
    }

    /** 
     * Recover from errors (SYNC)
     * @template E - type of error object
     * @template R - type of non-monadic result        
     * @param {function(E): R | Effect<F>} func
     * @returns {Effect<() => R>}
     * @throws {MonadError} 'Improper use of "catch" method'
     */
    catch(func) {
        /** @type {function(): R} */
        const effectNew = () => {
            try {
                const out = this._value();
                panicOnPromise(out, 'Effect.catch');                
                return out
            } catch(err) { 
                if (isMonadError(err)) { throw err }        
                const result = func(err);
                panicOnPromise(result, 'Effect.catch');                            
                panicOnAnotherLazyMonad.call(this, result, 'Effect.catch');
                if (result instanceof this.constructor) { return result._value() }
                if (isRightSMonad(result)) { return unwrapSMonad(result) } 
                return result
            }
        }
        return new Effect(effectNew)    
    }

    /** 
     * Recover from errors (ASYNC)
     * @template E - type of error object
     * @template R - type of non-monadic result       
     * @param {function(E): Promise<R | Effect<F>>} func
     * @returns {Effect<() => R>}
     * @throws {MonadError} 'Improper use of "catchAsync" method'
     */
    catchAsync(func) {
        /** @type {function(): Promise<R>} */
        const effectNew = async () => {
            try {
                return await this._value();              
            } catch(err) { 
                if (isMonadError(err)) { throw err }        
                const result = await func(err);                                             
                panicOnAnotherLazyMonad.call(this, result, 'Effect.catchAsync');
                if (result instanceof this.constructor) { return await result._value() }
                if (isRightSMonad(result)) { return unwrapSMonad(result) } 
                return result
            }
        }
        return new Effect(effectNew)    
    }

    /**       
     * @returns {R}
     * @throws {MonadError}
     */
    run() {
        const result = this._value();
        panicOnPromise(result, 'Effect.run');
        return result
    }

    /** @returns {Promise<R>} */
    async runAsync() {
        return await this._value()
    }

    /**
     * @template A
     * @template E     
     * @template R     
     * @param {{onRight?: function(A):R, onHalt?: function(E):R, onValue?: function(*):R}} handlers
     * Undefined properties are replaced by the identity function: val => val. 
     * onRight, onHalt - used for results as SMonads(according to the results of the mandatory isRight and isHalt methods).
     * onValue - used for results as simple values.
     * @returns {R}
     * @throws {MonadError} Effect - wrong type of the result or improper use of fold method.  
     */
    fold(handlers) {
        let { onRight = identical, onHalt = identical, onValue = identical } = handlers;
        const res = this._value();
        panicOnPromise(res, 'Effect.fold');
        panicOnLazyMapViolation(res, 'Effect.fold');
        if (isSMonad(res)) { return res.fold(onRight, onHalt) }
        else { return onValue(res) }
    }

    /**
     * @template A
     * @template E     
     * @template R     
     * @param {{onRight?: function(A):R, onHalt?: function(E):R, onValue?: function(*):R}} handlers
     * Undefined properties are replaced by the identity function: val => val. 
     * onRight, onHalt - used for results as SMonads(according to the results of the mandatory isRight and isHalt methods).
     * onValue - used for results as simple values.
     * All handlers may be ASYNC FUNCTIONS
     * @returns {Promise<R>}
     * @throws {MonadError} Effect - wrong type of the result    
     */
    async foldAsync(handlers) {
        let { onRight = identical, onHalt = identical, onValue = identical } = handlers;
        const res = await this._value();
        panicOnLazyMapViolation(res, 'Effect.foldAsync');
        if (isSMonad(res)) { return await res.fold(onRight, onHalt) }
        else { return await onValue(res) }
    }

    /**    
     * @template V     
     * @param {V} val   
     * @returns {Effect<F>}     
     */
    static pure(val) { return new Effect(() => val) }

    toString() { return `Effect(${this._value})`}
}


const CHAIN_MTD = "c"
const MAP_MTD = "m"

/** 
 * @template F
 * @extends {LMonad}
 * Works with functions like (S) => [V, S], where V - some value, S - your changeable state.
 * Async functions are possible.
 */
class State extends LMonad {
    /** 
     * @template V 
     * @template S   
     * @param {function(S): [V, S]} runState
     * @returns {State<F>}
     * @throws {MonadError} State requires a function  
     */
    static of(runState) {
        panicIfNotFunction(runState, 'static State.of'); 
        return new State(runState)
    }

    /**   
     * @template V 
     * @template S 
     * @param {function(S): [V, S] | Promise<[V, S]>} runState   
     * @returns {State<function(S): [V, S]>}
     * @throws {MonadError} State requires a function      
     */
    constructor(runState) {        
        panicIfNotFunction(runState, 'State.constructor'); 
        super(runState);        
        this._iterStore = [];
    }

    /**
     * @template V 
     * @param {function(V): State<F>} func 
     * @returns {State<F>}
     * @throws {MonadError} 'Improper use of "chain" method'
     */
    chain(func) {
        const newRun = (state) => {
            const initial = this._value(state);
            panicOnPromise(initial, 'State.chain');
            const [val, firstState] = initial;
            const stateMonad = func(val);
            panicOnAnotherInstance.call(this, stateMonad, 'State.chain'); 
            return stateMonad._value(firstState)
        }
        return new State(newRun)
    }

    /**
     * @template V 
     * @param {function(V): Promise<State<F>>} func 
     * @returns {Promise<State<F>>}
     * @throws {MonadError} 'Improper use of "chain" method'
     */
    chainAsync(func) {
        const newRun = async (state) => {
            const initial = await this._value(state);            
            const [val, firstState] = initial;
            const stateMonad = await func(val);
            panicOnAnotherInstance.call(this, stateMonad, 'State.chainAsync'); 
            return await stateMonad._value(firstState)
        }
        return new State(newRun)
    }

    /**
     * @template V 
     * @param {function(V): V} func 
     * @returns {State<F>}
     * @throws {MonadError} 'Improper use of "map" method - func must NOT return a Monad'
     */
    map(func) {
        const newRun = (state) => {
            const initial = this._value(state);
            panicOnPromise(initial, 'State.map');
            const [val, firstState] = initial;
            const newVal = func(val);
            panicOnPromise(newVal, 'State.map');
            panicOnLazyMapViolation(newVal, 'State.map');
            return [newVal, firstState]
        }
        return new State(newRun)
    }

    /**
     * @template V 
     * @param {function(V): Promise<V>} func 
     * @returns {State<F>}
     * @throws {MonadError} 'Improper use of "map" method - func must NOT return a Monad'
     */
    mapAsync(func) {
        const newRun = async (state) => {
            const initial = await this._value(state);            
            const [val, firstState] = initial;
            const newVal = await func(val);            
            panicOnLazyMapViolation(newVal, 'State.mapAsync');
            return [newVal, firstState]
        }
        return new State(newRun)
    }

    /** 
     * Recover from errors (SYNC)
     * @template V 
     * @template S       
     * @param {function(S): [V, S] | State<F>} func
     * @returns {State<F>}
     * @throws {MonadError} 'Improper use of "catch" method'
     */
    catch(func) {        
        const newRun = (state) => {            
            try {
                const initial = this._value(state);
                panicOnPromise(initial, 'State.catch');                             
                return initial
            } catch(err) { 
                if (isMonadError(err)) { throw err }        
                const result = func(state);
                panicOnPromise(result, 'State.catch');                             
                panicOnAnotherLazyMonad.call(this, result, 'State.catch');
                return (result instanceof this.constructor) ? result._value(state) : result               
            }
        }
        return new State(newRun)    
    }

    /** 
     * Recover from errors (ASYNC)
     * @template V 
     * @template S       
     * @param {function(S): Promise<[V, S] | State<F>>} func
     * @returns {State<F>}
     * @throws {MonadError} 'Improper use of "catchAsync" method'
     */
    catchAsync(func) {
        const newRun = async (state) => {            
            try {                
                return await this._value(state);               
            } catch(err) { 
                if (isMonadError(err)) { throw err }        
                const result = await func(state);                                                          
                panicOnAnotherLazyMonad.call(this, result, 'State.catchAsync');
                return (result instanceof this.constructor) ? await result._value(state) : result               
            }
        }
        return new State(newRun)    
    }

    /**    
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {[V,S]}
     */
    run(state) {
        const result = this._value(state);
        panicOnPromise(result, 'State.run');
        return result
    }

    /**
     * @async    
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {Promise<[V,S]>}
     */
    async runAsync(state) { return await this._value(state) }

    /**    
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {[V,S]}
     * The same as run. Made for interface uniformity with Effect monad 
     */
    fold(state) {
        const result = this._value(state);
        panicOnPromise(result, 'State.fold');
        return result
    }
    
    /**    
     * @async
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {Promise<[V,S]>}
     * The same as runAsync. Made for interface uniformity with Effect monad 
     */
    async foldAsync(state) { return await this._value(state) } 
    
    toString() { return `State(${this._value})`}

    /**
     * @template V 
     * @param {function(V): State<F>} func 
     * @returns {void}   
     * Stores functions in an array for execution through flat iteration.
     * It can be useful for very long chains to avoid possible stack overflows. 
     * !!!-MATTER-!!!: returns the same monad - folding functions into its current structure.
     * Only for SYNC functions.   
     */
    chainIter(func) { this._iterStore.push([func, CHAIN_MTD]); return this }

    /**
     * @template V 
     * @param {function(V): V} func 
     * @returns {void} 
     * Stores functions in an array for execution through flat iteration.
     * It can be useful for very long chains to avoid possible stack overflows.  
     * !!!-MATTER-!!!: returns the same monad - folding functions into its current structure.
     * Only for SYNC functions.    
     */
    mapIter(func) { this._iterStore.push([func, MAP_MTD]); return this }

    /**    
     * @template V 
     * @template S 
     * @param {S} state  
     * @param {boolean} clear if true - clear iteration structure after execution. DEFAULT true.   
     * @returns {[V,S]}
     * @throws {MonadError} Improper use of chainIter and mapIter methods
     * First, it runs the standard run() method.
     * And then iterates over the functions added through chainIter and mapIter methods.
     * Only for SYNC functions.
     */
    runIter(state, clear=true) {
        try {
            const initial = this._value(state);
            panicOnPromise(initial, 'State.runIter');           
            let [val, newState] = initial;
            for(const [func, method] of this._iterStore) {
                if (method === CHAIN_MTD) {
                    const stateMonad = func(val);
                    panicOnAnotherInstance.call(this, stateMonad, 'State.runIter');
                    [val, newState] =  stateMonad._value(newState);
                } else if (method === MAP_MTD) {
                    val = func(val);
                    panicOnLazyMapViolation(val, 'State.runIter');               
                }
            }
            return [val, newState]
        } finally {
            if(clear) { this._iterStore = [] }
        }        
    }

    /**    
     * @template V     
     * @param {V} val   
     * @returns {State<F>}     
     */
    static pure(val) { return new State(state => [val, state]) }
    
    /** @returns {State<function(S): [S, S]>} */
    static get() { return new State(state => [state, state]) }
    
    /** 
     * @template S     
     * @param {S} newState     
     * @returns {State<function(S): [null, S]>}     
     */
    static put(newState) { return new State(_ => [null, newState]) }
}


return {
    MonadError,
    Monad,
    SMonad,
    LMonad,
    Either,
    Maybe,
    Success,
    Fail,
    Just,
    Nothing,
    Effect,
    State,
}

}())
