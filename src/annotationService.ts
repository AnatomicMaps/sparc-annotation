/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2023  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

/**
 * Annotation about an item in a resource.
 */
export interface AnnotationData
{
    created: string    // timestamp...
    creator: UserData
    resource: string
    item: string
    evidence: string[]
    comment: string
}

//==============================================================================

const SERVER_TIMEOUT = 10000  //  10 seconds

//==============================================================================

/**
 * Information about an error result.
 */
export interface ErrorResult {
    error: string
}

/**
 * Information about a logged in user.
 */
export interface UserData {
    name: string
    email: string
    orcid: string
    canUpdate: boolean
}

//==============================================================================

function getCookie(name: string): string
{
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
        return parts.pop()!.split(';').shift() || ''
    }
    return ''
}

//==============================================================================

/**
 * Interface to a SPARC map annotation service.
 */
export class AnnotationService
{
    #serverEndpoint: string;
    #currentError: ErrorResult|null = null
    #currentUser: UserData|null = null

    /**
     * @param  serverEndpoint  The URL of a map annotation service.
     */
    constructor(serverEndpoint: string)
    {
        if (serverEndpoint.slice(-1) === '/') {     // Strip any trailing slash
            this.#serverEndpoint = serverEndpoint.slice(0, -1)
        } else {
            this.#serverEndpoint = serverEndpoint
        }
    }

    /**
     * Get information about the logged-in SPARC user.
     *
     * Requires {@linkcode authenticate} to first be called.
     */
    get currentUser()
    {
        return this.#currentUser
    }

    /**
     * Get information about any error from the last call
     * to {@linkcode authenticate}.
     */
    get currentError()
    {
        return this.#currentError
    }

    /**
     * Authenticate the logged-in SPARC user.
     *
     * @return  A Promise resolving to either data about a valid user
     *          or a reason why the user is invalid.
     */
    async authenticate(): Promise<UserData|ErrorResult>
    //=================================================
    {
        this.#currentError = null
        this.#currentUser = null
        const userData = await this.#request('authenticate')
        if ('error' in userData) {
            this.#currentError = userData
        } else if ('token' in userData) {
            this.#currentUser = userData
            return Promise.resolve(this.#currentUser!)
        }
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Get identifiers of all annotated items in a resource.
     *
     * @param  resourceId  The resource's identifier
     * @return             Identifiers of annotated items.
     */
    annotatedItemIds(resourceId: string): string[]
    //============================================
    {
        return []
    }

    /**
     * Get all annotations about a specific item in a resource.
     *
     * @param   resourceId  The resource's identifier
     * @param   itemId      The item's identifier within the resource
     * @return              All annotations about the item.
     */
    annotations(resourceId: string, ItemId: string): AnnotationData[]
    //===============================================================
    {
        return []
    }

    /**
     * Add an annotation about a specific item in a resource.
     *
     * @param  resourceId  The resource's identifier
     * @param  itemId      The item's identifier within the resource
     * @param  annotation  Annotation about the feature
     */
    addAnnotation(resourceId: string, ItemId: string, annotation: AnnotationData)
    {
        if (this.#currentUser && this.#currentUser.canUpdate) {
            // set annotation provenance from this.#currentUser
            // set timestamp

        }
    }

    async #request(endpoint: string, method: 'GET'|'POST'='GET', parameters: Record<string, string>={})
    //=================================================================================================
    {
        let noResponse = true
        const abortController = new AbortController()
        setTimeout(() => {
            if (noResponse) {
                console.log('Annotation server timeout...')
                abortController.abort();
                // how is the promise resolved/rejected when there's a timeout??
                }
            },
            SERVER_TIMEOUT)

        const options: RequestInit = {
            method: method,
            signal: abortController.signal
        }
        let url = `${this.#serverEndpoint}/${endpoint}`
        const userApiKey = getCookie('user-token')
        if (method === 'GET') {
            const params = []
            for (const [key, value] of Object.entries(parameters)) {
                params.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`)
            }
            params.push(`key=${encodeURIComponent(userApiKey)}`)
            url += '?' + params.join('&')
            options['headers'] = {
                "Accept": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            }
        } else if (method === 'POST') {
            const params = Object.assign({key: userApiKey}, parameters)
            options['body'] = JSON.stringify(params)
            options['headers'] = {
                "Accept": "application/json; charset=utf-8",
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            }
        }
        const response = await fetch(url, options);
        noResponse = false
        if (response.ok) {
            return Promise.resolve(await response.json())
        } else {
            return Promise.resolve({error: `${response.status} ${response.statusText}`})
        }
    }
}

//==============================================================================
