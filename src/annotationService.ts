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

import Cookies from 'js-cookie'

//==============================================================================

/**
 * A flatmap feature.
 */
export interface MapFeature
{
    id: string
    geometry: {
        type: string
        coordinates: any[]
    }
    properties: Record<string, any>
}

/**
 * Annotation about an item in a resource.
 */
export interface UserAnnotation
{
    resource: string
    item: string
    body: Record<string, any>,
    feature?: MapFeature
}

interface AnnotationRequest extends UserAnnotation
{
    created: string    // timestamp...
    creator: UserData
}

/**
 * Full annotation about an item in a resource.
 */
export interface Annotation extends AnnotationRequest
{
    id: URL
}


//==============================================================================

export interface AnnotationResponse extends Annotation
{
    annotationID: number
}

export interface ItemListResponse
{
    resource: string,
    items: string[]
}

export interface FeatureListResponse
{
    resource: string,
    features: MapFeature[]
}

//==============================================================================

/**
 * Information about an error response.
 */
export interface ErrorResponse {
    error: string
}

/**
 * Information about an successful response.
 */
export interface SuccessResponse {
    success: string
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

const SERVER_TIMEOUT = 10000    //  10 seconds

//==============================================================================

/**
 * Interface to a SPARC map annotation service.
 */
export class AnnotationService
{
    #serverEndpoint: string;
    #currentUser: UserData|null = null
    #currentError: ErrorResponse|null = null

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
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @return  A Promise resolving to either data about a valid user
     *          or a reason why the user is invalid.
     */
    async authenticate(userApiKey: string): Promise<UserData|ErrorResponse>
    //=====================================================================
    {
        this.#currentError = null
        this.#currentUser = null
        const userData = await this.#request(userApiKey, 'authenticate')
        if (!('error' in userData)) {
            Cookies.set('annotation-key', userData.session, { secure: true, expires: 1 })
            this.#currentUser = userData.data
            return Promise.resolve(this.#currentUser!)
        }
        Cookies.remove('annotation-key')
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Unauthenticate with the annotation service.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @return A Promise with data about the call.
     */
    async unauthenticate(userApiKey: string): Promise<SuccessResponse|ErrorResponse>
    //==============================================================================
    {
        this.#currentError = null
        this.#currentUser = null
        const responseData = await this.#request(userApiKey, 'unauthenticate')
        if ('success' in responseData) {
            return Promise.resolve(responseData)
        }
        return Promise.resolve(this.#currentError!)
     }

    /**
     * Get identifiers of all annotated items in a resource.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @param  resourceId  The resource's identifier
     * @return             A Promise resolving to either a list of
     *                     identifiers of annotated items or a reason
     *                     why identifiers couldn't be retrieved.
     */
    async annotatedItemIds(userApiKey: string, resourceId: string): Promise<ItemListResponse|ErrorResponse>
    //=====================================================================================================
    {
        const itemIds = await this.#request(userApiKey, 'items/', 'GET', {
            resource: resourceId
        })
        if (!('error' in itemIds)) {
            return Promise.resolve(itemIds)
        }
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Get all annotated features drawn on a resource.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @param  resourceId  The resource's identifier
     * @return             A Promise resolving to either a list of annotated
     *                     features drawn on the resource or a reason why
     *                     features couldn't be retrieved.
     */
    async drawnFeatures(userApiKey: string, resourceId: string): Promise<FeatureListResponse[]|ErrorResponse>
    //=======================================================================================================
    {
        const features = await this.#request(userApiKey, 'features/', 'GET', {
            resource: resourceId
        })
        if (!('error' in features)) {
            return Promise.resolve(features)
        }
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Get all annotations about a specific item in a resource.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @param  resourceId  The resource's identifier
     * @param  itemId      The item's identifier within the resource
     * @return             A Promise resolving to either a list of
     *                     annotations about the item or a reason
     *                     why annotations couldn't be retrieved.
     */
    async itemAnnotations(userApiKey: string, resourceId: string, ItemId: string): Promise<AnnotationResponse[]|ErrorResponse>
    //========================================================================================================================
    {
        const annotations = await this.#request(userApiKey, 'annotations/', 'GET', {
            resource: resourceId,
            item: ItemId
        })
        if (!('error' in annotations)) {
            return Promise.resolve(annotations)
        }
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Get details of a specific annotation.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @param  annotationId  The annotation's URI
     * @return               A Promise resolving to either an annotation
     *                       with the given URI or a reason why the
     *                       annotation couldn't be retrieved.
     */
    async annotation(userApiKey: string, annotationId: URL): Promise<AnnotationResponse|ErrorResponse>
    //================================================================================================
    {
        const annotation = await this.#request(userApiKey, 'annotation/', 'GET', {
            annotation: annotationId
        })
        if (!('error' in annotation)) {
            return Promise.resolve(annotation)
        }
        return Promise.resolve(this.#currentError!)
    }

    /**
     * Add an annotation about a specific item in a resource.
     *
     * @param  userApiKey  The Api token of the logged-in Pennsieve user
     * @param   annotation  Annotation about the feature
     * @return              A Promise resolving to either the resulting
     *                      full annotation or a reason why the
     *                      annotation couldn't be added
     */
    async addAnnotation(userApiKey: string, userAnnotation: UserAnnotation): Promise<AnnotationResponse|ErrorResponse>
    //================================================================================================================
    {
        if (this.#currentUser && this.#currentUser.canUpdate) {
            const annotationRequest: AnnotationRequest = Object.assign({
                creator: this.#currentUser,
                created: (new Date()).toISOString()
            }, userAnnotation)
            const annotationResponse = await this.#request(userApiKey, `annotation/`, 'POST', {
                data: annotationRequest})
            if (!('error' in annotationResponse)) {
                return Promise.resolve(annotationResponse)
            }
            this.#currentError = annotationResponse
        } else {
            this.#currentError = { error: 'user cannot add annotation' }
        }
        return Promise.resolve(this.#currentError!)
    }

    async #request(userApiKey: string, endpoint: string, method: 'GET'|'POST'='GET', parameters={})
    //=============================================================================================
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
        const sessionKey = <string>Cookies.get('annotation-key') || ''
        if (method === 'GET') {
            const params = []
            for (const [key, value] of Object.entries(parameters)) {
                params.push(`${key}=${encodeURIComponent(JSON.stringify(value))}`)
            }
            params.push(`key=${encodeURIComponent(userApiKey)}`)
            params.push(`session=${encodeURIComponent(sessionKey)}`)
            url += '?' + params.join('&')
            options['headers'] = {
                "Accept": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            }
        } else if (method === 'POST') {
            const params = Object.assign({
                key: userApiKey,
                session: sessionKey
            }, parameters)
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
            this.#currentError = {error: `${response.status} ${response.statusText}`}
            return Promise.resolve(this.#currentError)
        }
    }
}

//==============================================================================
