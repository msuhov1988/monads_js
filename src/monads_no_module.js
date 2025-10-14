"use strict"

const Monads = (function() {

class MonadError extends Error {
    constructor(message) {
        super(`MonadError: ${message}`);
        this.name = "MonadError";
    }
}


class Monad {
    static of() { throw new MonadError("Static Monad.of must be defined in subclass") }

    constructor(value) { this._value = value }
    
    chain() { throw new MonadError("Monad.chain must be defined in subclass") }

    map() { throw new MonadError("Monad.map must be defined in subclass") }    

    fold() { throw new MonadError("Monad.fold must be defined in subclass") }

    toString() { throw new MonadError("Monad.toString must be defined in subclass") }    
}


const S_BRAND = Symbol('SMonad');
const L_BRAND = Symbol('LMonad');


/**
 * @template P
 * @extends {Monad}
 * SMonad - simple monads like Either, Maybe.
 */
class SMonad extends Monad {     
    constructor(value) { super(value); this[S_BRAND] = true; }  

    ap() { throw new MonadError("SMonad.ap must be defined in subclass")  }

    isRight() { throw new MonadError("SMonad.isRight must be defined in subclass") }

    isHalt() { throw new MonadError("SMonad.isHalt must be defined in subclass") }    

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


const isSMonad = v => Boolean(v && v[S_BRAND]);
const isLMonad = v => Boolean(v && v[L_BRAND]);

const identical = val => val


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
     */
    static try(testedFunc) {
        try {
            const result = testedFunc();            
            if (result instanceof Promise) {
                throw new MonadError('Either.try - function must NOT return Promise.')
            }
            return new Success(result)
        } catch(error) {
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
    static of(value) {        
        return new Success(value)        
    }    

    /**
     * @param {A} value
     */
    constructor(value) { super(value) } 
    
    /**    
     * @param {function(A): SMonad} func
     * @returns {SMonad}
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    chain(func) {       
        const res = func(this._value);
        if (!isSMonad(res)) {
            throw new MonadError('Improper use of "chain" method - function must return SMonad')
        }
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
        if (isSMonad(res)) {
            throw new MonadError('Improper use of "map" method - function must NOT return SMonad')
        }        
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
     * @template V
     * @template R
     * @param {SMonad<V>} valueContainer
     * @returns {SMonad<R>} 
     * Applies a value enclosed in a container to function in the container.
     * Mixing Either and Maybe is possible.
     * Monad of the argument defines monad of the result
     * @throws {MonadError} 
     */
    ap(valueContainer) {        
        if (typeof this._value !== 'function') {
            throw new MonadError('.ap: A monad must contain a function')
        }
        if (!isSMonad(valueContainer)) {
            throw new MonadError('.ap: Argument must be an SMonad entity')    
        }        
        if(valueContainer.isHalt()) { return valueContainer }
                
        const res = this._value(valueContainer._value);               
        return valueContainer.constructor.of(res)  
    }

    /**    
     * @returns {true}
     */
    isRight() { return true }

    /**    
     * @returns {false}
     */
    isHalt() { return false }

    /**    
     * @returns {true} for point-by-point introspection
     */
    isSuccess() { return true }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isFail() { return false }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isJust() { return false }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isNothing() { return false }

    /**
     * @template V
     * @param {V} _
     * @returns {A}
    */
    getOrElse(_) { return this._value }    

    /**     
     * @returns {A}
     */
    result() { return this._value }

    /**
     * @template R
     * @template E
     * @param {function(A): R} onSuccess 
     * @param {function(E): R} onFail     
     * @returns {R} 
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
    static of(value) {        
        return new Fail(value)        
    }    

    /**
     * @param {E} value
     */
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
        if (!isSMonad(res)) {
            throw new MonadError('Improper use of "chain" method - function must return SMonad')
        }
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
        if (isSMonad(res)) {
            throw new MonadError('Improper use of "map" method - function must NOT return SMonad')
        }
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
     * @template V
     * @param {SMonad<V>} _
     * @returns {Fail<E>}
     * Applies a value enclosed in a container to a function in the container.     
     */
    ap(_) { return this }

    /**    
     * @returns {false}
     */
    isRight() { return false }

    /**    
     * @returns {true}
     */
    isHalt() { return true }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isSuccess() { return false } 

    /**    
     * @returns {true} for point-by-point introspection
     */
    isFail() { return true }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isJust() { return false }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isNothing() { return false }

    /** 
     * @template V    
     * @param {V} value
     * @returns {V}
    */
    getOrElse(value) { return value } 

    /**     
     * @throws {MonadError} No result inside the Fail container.
     */
    result() { throw new MonadError("Cannot extract result from the Fail container") }

    /**
     * @template A
     * @template R
     * @param {function(A): R} onSuccess 
     * @param {function(E): R} onFail      
     * @returns {R} 
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
    static of(value) {
        return new Just(value)        
    }    

    /**
     * @param {A} value
     */
    constructor(value) { super(value) } 
    
    /**    
     * @param {function(A): SMonad} func
     * @returns {SMonad}
     * @throws {MonadError} 'Improper use of "chain" method - function must return SMonad'
    */
    chain(func) {
        const res = func(this._value);        
        if (!isSMonad(res)) {
            throw new MonadError('Improper use of "chain" method - function must return SMonad')
        }        
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
        if (isSMonad(res)) {
            throw new MonadError('Improper use of "map" method - function must NOT return SMonad')
        }                
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
     * @template V
     * @template R
     * @param {SMonad<V>} valueContainer
     * @returns {SMonad<R>}
     * Applies a value enclosed in a container to function in the container.
     * Mixing Either and Maybe is possible
     * Monad of argument defines monad of the result
     * @throws {MonadError}
     */
    ap(valueContainer) {
        if (typeof this._value !== 'function') {
            throw new MonadError('.ap: A monad must contain a function')
        }
        if (!isSMonad(valueContainer)) {
            throw new MonadError('.ap: Argument must be an SMonad entity')    
        }        
        if(valueContainer.isHalt()) { return valueContainer } 
        
        const res = this._value(valueContainer._value);        
        return valueContainer.constructor.of(res)  
    }

    /**    
     * @returns {true}
     */
    isRight() { return true }

    /**    
     * @returns {false}
     */
    isHalt() { return false }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isSuccess() { return false }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isFail() { return false }

    /**    
     * @returns {true} for point-by-point introspection
     */
    isJust() { return true }

    /**    
     * @returns {false} for point-by-point introspection
     */
    isNothing() { return false }

    /**
     * @template V
     * @param {V} _
     * @returns {A}
    */
    getOrElse(_) { return this._value }    

    /**     
     * @returns {A}
     */
    result() { return this._value }

    /**
     * @template R     
     * @param {function(A): R} onJust     
     * @param {function(): R} onNothing 
     * @returns {R} 
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
    static of(_) {
        return new Nothing()        
    }    
    
    /**
     * @param {*} _ argument is unnecessary, only for uniformity of interfaces purpose
     */
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
        if (!isSMonad(res)) {
            throw new MonadError('Improper use of "chain" method - function must return SMonad')
        }
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
        if (isSMonad(res)) {
            throw new MonadError('Improper use of "map" method - function must NOT return SMonad')
        }
        return new Just(res)
    } 

    /**
     * @template V
     * @param {SMonad<V>} _
     * @returns {Nothing}
     * Applies a value enclosed in a container to a function in the container.     
     */
    ap(_) { return this }

    /**    
     * @returns {false}
     */
    isRight() { return false }

    /**    
     * @returns {true}
     */
    isHalt() { return true }

    /**    
     * @returns {false}
     */
    isSuccess() { return false }

    /**    
     * @returns {false}
     */
    isFail() { return false }

    /**    
     * @returns {false}
     */
    isJust() { return false }

    /**    
     * @returns {true}
     */
    isNothing() { return true }

    /** 
     * @template V    
     * @param {V} value
     * @returns {V}
    */
    getOrElse(value) { return value } 

    /**     
     * @throws {MonadError} No result inside the Nothing container.
     */
    result() { throw new MonadError("Cannot extract result from the Nothing container") }

    /**
     * @template A
     * @template R
     * @param {function(A): R} onJust     
     * @param {function(): R} onNothing 
     * @returns {R} 
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
        if (typeof effect !== 'function') {
            throw new MonadError('Effect requires a function')
        }
        return new Effect(effect)
    }

    /**     
     * @param {function(): R} effect
     * @throws {MonadError} Effect requires a function 
     */
    constructor(effect) {
        super(undefined)
        if (typeof effect !== 'function') {
            throw new MonadError('Effect requires a function')
        }
        /**
         * @type {function(): R}
         */
        this._effect = effect
    }

    /**      
     * @param {function(R): Effect<F>} func 
     * @returns {Effect<F>}    
     * @throws {MonadError} 'Improper use of "chain" method'
     */
    chain(func) {        
        /**
         * @type {function(): U}
         */       
        const effectNew = () => {            
            let out = this._effect();
            if (out instanceof Promise) {
                throw new MonadError('Effect.chain - inner function must NOT return Promise. Use chainAsync instead')
            }
            if (isSMonad(out)) {
                if (out.isHalt?.()) { return out }
                if (out.isRight?.()) { out = out.result() }
            }          
            const resultEff = func(out); 
            if (!(resultEff instanceof Effect)) {
                throw new MonadError('Improper use of "chain" method - func must return an Effect')
            }
            const result = resultEff._effect()  
            if (isSMonad(result) && result.isRight?.()) { return result.result() } 
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
        /**
         * @async
         * @type {function(): Promise<U>}
         */       
        const effectNew = async () => {            
            let out = await this._effect();                       
            if (isSMonad(out)) {
                if (out.isHalt?.()) { return out }
                if (out.isRight?.()) { out = out.result() }
            }          
            const resultEff = await asyncFunc(out); 
            if (!(resultEff instanceof Effect)) {
                throw new MonadError('Improper use of "chainAsync" method - func must return an Effect')
            }
            const result = await resultEff._effect();          
            if (isSMonad(result) && result.isRight?.()) { return result.result() } 
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
        /**
         * @type {function(): R}
         */
        const effectNew = () => {
            let out = this._effect();
            if (out instanceof Promise) {
                throw new MonadError('Effect.map - inner function must NOT return Promise. Use mapAsync instead')
            }
            if (isSMonad(out)) {
                if (out.isHalt?.()) { return out }
                if (out.isRight?.()) { out = out.result() }
            }          
            const result = func(out);
            if (result instanceof Promise) {
                throw new MonadError('Effect.map - argument function must NOT return Promise. Use mapAsync instead')
            }                              
            if (isLMonad(result)) {
                throw new MonadError('Improper use of "map" method - func must NOT return LMonad')
            }
            if (isSMonad(result) && result.isRight?.()) { return result.result() } 
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
        /**
         * @async
         * @type {function(): Promise<R>}
         */
        const effectNew = async () => {
            let out = await this._effect();            
            if (isSMonad(out)) {
                if (out.isHalt?.()) { return out }
                if (out.isRight?.()) { out = out.result() }
            }          
            const result = await asyncFunc(out);                                         
            if (isLMonad(result)) {
                throw new MonadError('Improper use of "mapAsync" method - func must NOT return LMonad')
            }
            if (isSMonad(result) && result.isRight?.()) { return result.result() } 
            return result
        }
        return new Effect(effectNew)
    }

    /**       
     * @returns {R}
     * @throws {MonadError}
     */
    run() {
        const result = this._effect();
        if (result instanceof Promise) {
            throw new MonadError('Effect.run - inner function must NOT return Promise. Use runAsync instead. ')
        }
        return result
    }

    /**       
     * @returns {Promise<R>}
     */
    async runAsync() {
        return await this._effect()
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
        let {onRight, onHalt, onValue} = handlers;
        if (!onRight) { onRight = identical }
        if (!onHalt) { onHalt = identical }        
        if (!onValue) { onValue = identical }
        const res = this._effect();
        if (res instanceof Promise) {
            throw new MonadError('Effect.fold - inner function must NOT return Promise. Use foldAsync instead. ')   
        }
        if (isSMonad(res)) {
            return res.fold(onRight, onHalt)
        } else if (isLMonad(res)) { 
            throw new MonadError(`Effect - wrong type of the result: ${res}`)    
        } else {
            return onValue(res)
        }
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
        let {onRight, onHalt, onValue} = handlers;
        if (!onRight) { onRight = identical }
        if (!onHalt) { onHalt = identical }        
        if (!onValue) { onValue = identical }
        const res = await this._effect()
        if (isSMonad(res)) {
            return await res.fold(onRight, onHalt)
        } else if (isLMonad(res)) { 
            throw new MonadError(`Effect - wrong type of the result: ${res}`)    
        } else {
            return await onValue(res)
        }
    }

    /**    
     * @template V     
     * @param {V} val   
     * @returns {Effect<F>}     
     */
    static pure(val) {        
        return new Effect(() => val)
    }

    toString() { return `Effect(${this._effect})`}
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
        if (typeof runState !== 'function') {
            throw new MonadError('State requires a function')
        }
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
        super(undefined)
        if (typeof runState !== 'function') {
            throw new MonadError('State requires a function')
        }
        /**
         * @type {function(S): [V, S] | Promise<[V, S]}
         */
        this._run = runState;
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
            const initial = this._run(state);
            if (initial instanceof Promise) {
                throw new MonadError('State.chain - inner function must NOT return Promise. Use chainAsync instead')    
            }
            const [val, firstState] = initial;
            const stateMonad = func(val);
            if (!(stateMonad instanceof State)) {
                throw new MonadError('Improper use of "chain" method - func must return a State')
            }
            return stateMonad._run(firstState)
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
            const initial = await this._run(state);            
            const [val, firstState] = initial;
            const stateMonad = await func(val);
            if (!(stateMonad instanceof State)) {
                throw new MonadError('Improper use of "chain" method - func must return a State')
            }
            return await stateMonad._run(firstState)
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
            const initial = this._run(state);
            if (initial instanceof Promise) {
                throw new MonadError('State.map - inner function must NOT return Promise. Use mapAsync instead')    
            }
            const [val, firstState] = initial;
            const newVal = func(val);
            if (newVal instanceof Promise) {
                throw new MonadError('State.map - function must NOT return Promise. Use mapAsync instead')    
            }
            if (isLMonad(newVal) || isSMonad(newVal)) {
                throw new MonadError('Improper use of "map" method - func must NOT return a Monad')
            }
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
            const initial = await this._run(state);            
            const [val, firstState] = initial;
            const newVal = await func(val);            
            if (isLMonad(newVal) || isSMonad(newVal)) {
                throw new MonadError('Improper use of "map" method - func must NOT return a Monad')
            }
            return [newVal, firstState]
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
        const result = this._run(state);
        if (result instanceof Promise) {
            throw new MonadError('State.run - inner function must NOT return Promise. Use runAsync instead')    
        }
        return result
    }

    /**
     * @async    
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {Promise<[V,S]>}
     */
    async runAsync(state) {        
        return await this._run(state)
    }

    /**    
     * @template V 
     * @template S 
     * @param {S} state    
     * @returns {[V,S]}
     * The same as run. Made for interface uniformity with Effect monad 
     */
    fold(state) {
        const result = this._run(state);
        if (result instanceof Promise) {
            throw new MonadError('State.fold - inner function must NOT return Promise. Use foldAsync instead')    
        }
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
    async foldAsync(state) {
        return await this._run(state)
    } 
    
    toString() { return `State(${this._run})`}

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
     * @returns {[V,S]}
     * @throws {MonadError} Improper use of chainIter and mapIter methods
     * First, it runs the standard run() method.
     * And then iterates over the functions added through chainIter and mapIter methods.
     * Only for SYNC functions.
     */
    runIter(state, clear=true) {
        try {
            const initial = this._run(state);
            if (initial instanceof Promise) {
                throw new MonadError('State.runIter - inner function must NOT return Promise.')    
            }            
            let [val, newState] = initial;
            for(const [func, method] of this._iterStore) {
                if (method === CHAIN_MTD) {
                    const stateMonad = func(val);
                    if (!(stateMonad instanceof State)) {
                        throw new MonadError('Improper use of "chainIter" - func must return a State')
                    }
                    [val, newState] =  stateMonad._run(newState);
                } else if (method === MAP_MTD) {
                    val = func(val);
                    if (isLMonad(val) || isSMonad(val)) {
                        throw new MonadError('Improper use of "mapIter" - func must NOT return a Monad')
                    }                
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
    static pure(val) {        
        return new State(state => [val, state])
    }
    
    /**         
     * @returns {State<function(S): [S, S]>}     
     */
    static get() {       
        return new State(state => [state, state])
    }
    
    /** 
     * @template S     
     * @param {S} newState     
     * @returns {State<function(S): [null, S]>}     
     */
    static put(newState) {        
        return new State(_ => [null, newState])
    }
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
