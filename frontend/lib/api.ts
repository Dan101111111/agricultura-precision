/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock API - acepta cualquier llamada sin errores TypeScript.
// Cuando el backend esté disponible, reemplazar con el cliente tRPC real.
const createProxy = (): any =>
  new Proxy(
    {},
    {
      get(_target, _prop) {
        return new Proxy(
          () => ({ data: undefined as any, isLoading: false, refetch: () => {} }),
          {
            get(_t, p) {
              if (p === 'useQuery' || p === 'useMutation') {
                return (_args?: any) => ({
                  data: undefined as any,
                  isLoading: false,
                  mutate: (_v?: any) => {},
                  refetch: () => {},
                })
              }
              return createProxy()
            },
          }
        )
      },
    }
  )

export const api: any = createProxy()
