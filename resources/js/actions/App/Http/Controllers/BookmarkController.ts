import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\BookmarkController::store
 * @see app/Http/Controllers/BookmarkController.php:16
 * @route '/books/{book}/bookmarks'
 */
export const store = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/books/{book}/bookmarks',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\BookmarkController::store
 * @see app/Http/Controllers/BookmarkController.php:16
 * @route '/books/{book}/bookmarks'
 */
store.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { book: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    book: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        book: typeof args.book === 'object'
                ? args.book.id
                : args.book,
                }

    return store.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\BookmarkController::store
 * @see app/Http/Controllers/BookmarkController.php:16
 * @route '/books/{book}/bookmarks'
 */
store.post = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\BookmarkController::store
 * @see app/Http/Controllers/BookmarkController.php:16
 * @route '/books/{book}/bookmarks'
 */
    const storeForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\BookmarkController::store
 * @see app/Http/Controllers/BookmarkController.php:16
 * @route '/books/{book}/bookmarks'
 */
        storeForm.post = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(args, options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\BookmarkController::update
 * @see app/Http/Controllers/BookmarkController.php:36
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
export const update = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/books/{book}/bookmarks/{bookmark}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\BookmarkController::update
 * @see app/Http/Controllers/BookmarkController.php:36
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
update.url = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    book: args[0],
                    bookmark: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        book: typeof args.book === 'object'
                ? args.book.id
                : args.book,
                                bookmark: typeof args.bookmark === 'object'
                ? args.bookmark.id
                : args.bookmark,
                }

    return update.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace('{bookmark}', parsedArgs.bookmark.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\BookmarkController::update
 * @see app/Http/Controllers/BookmarkController.php:36
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
update.patch = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\BookmarkController::update
 * @see app/Http/Controllers/BookmarkController.php:36
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
    const updateForm = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\BookmarkController::update
 * @see app/Http/Controllers/BookmarkController.php:36
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
        updateForm.patch = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\BookmarkController::destroy
 * @see app/Http/Controllers/BookmarkController.php:56
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
export const destroy = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/books/{book}/bookmarks/{bookmark}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\BookmarkController::destroy
 * @see app/Http/Controllers/BookmarkController.php:56
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
destroy.url = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    book: args[0],
                    bookmark: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        book: typeof args.book === 'object'
                ? args.book.id
                : args.book,
                                bookmark: typeof args.bookmark === 'object'
                ? args.bookmark.id
                : args.bookmark,
                }

    return destroy.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace('{bookmark}', parsedArgs.bookmark.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\BookmarkController::destroy
 * @see app/Http/Controllers/BookmarkController.php:56
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
destroy.delete = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\BookmarkController::destroy
 * @see app/Http/Controllers/BookmarkController.php:56
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
    const destroyForm = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: destroy.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\BookmarkController::destroy
 * @see app/Http/Controllers/BookmarkController.php:56
 * @route '/books/{book}/bookmarks/{bookmark}'
 */
        destroyForm.delete = (args: { book: number | { id: number }, bookmark: number | { id: number } } | [book: number | { id: number }, bookmark: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: destroy.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    destroy.form = destroyForm
const BookmarkController = { store, update, destroy }

export default BookmarkController