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

export interface MockOidcOptions {
  status?: number;
  expiresIn?: number;
  token?: string;
}

export function createMockOidcHandler(
  tokenUrl: string,
  options?: MockOidcOptions,
) {
  return http.post(tokenUrl, () => {
    if (options?.status && options.status >= 400) {
      return new HttpResponse(null, { status: options.status });
    }
    return HttpResponse.json({
      access_token: options?.token ?? "mock-access-token",
      expires_in: options?.expiresIn ?? 3600,
      token_type: "Bearer",
    });
  });
}
