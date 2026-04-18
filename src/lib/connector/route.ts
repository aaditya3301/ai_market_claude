import { NextResponse } from 'next/server';
import {
  authenticateConnectorRequest,
  ConnectorAuthError,
  type ConnectorAuthResult,
} from '@/lib/connector/auth';
import { envelopeError } from '@/lib/api-envelope';
import { withApiRequestContext } from '@/lib/runtime/route-context';

export async function withConnectorRoute(
  req: Request,
  config: {
    scope: string;
    endpoint: string;
    handler: (auth: ConnectorAuthResult) => Promise<NextResponse>;
  }
) {
  try {
    const auth = await authenticateConnectorRequest(req, config.scope);

    return withApiRequestContext(
      req,
      {
        tenantId: auth.tenantId,
        endpoint: config.endpoint,
      },
      () => config.handler(auth)
    );
  } catch (error: unknown) {
    if (error instanceof ConnectorAuthError) {
      return NextResponse.json(
        envelopeError(error.code, error.message, undefined, {
          api_version: 'v1',
          step: config.endpoint,
        }),
        { status: 401 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      envelopeError('INTERNAL_ERROR', message, undefined, {
        api_version: 'v1',
        step: config.endpoint,
      }),
      { status: 500 }
    );
  }
}
