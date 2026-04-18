export type ConnectorSdkPlaceholder = {
  status: 'stub';
};

export function getConnectorSdkStatus(): ConnectorSdkPlaceholder {
  return { status: 'stub' };
}
