// Copyright Operaton contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { http, HttpResponse } from "msw";

let capturedAuthHeader: string | null = null;
let capturedRequestUrl: string | null = null;

export const captureAuthHeader = http.get("http*", ({ request }) => {
  capturedAuthHeader = request.headers.get("Authorization");
  capturedRequestUrl = request.url;
  return HttpResponse.json([{ name: "default" }]);
});

export function getLastAuthHeader(): string | null {
  return capturedAuthHeader;
}

export function getLastRequestUrl(): string | null {
  return capturedRequestUrl;
}

export function resetCapturedState(): void {
  capturedAuthHeader = null;
  capturedRequestUrl = null;
}
