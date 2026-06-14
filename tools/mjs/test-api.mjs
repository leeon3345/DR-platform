import { handleRequest } from './server/server.mjs';

const mockRequest = {
  method: 'POST',
  url: '/api/agent/status',
  headers: new Map([
    ['authorization', 'Bearer usr_b7224d9e'],
    ['content-type', 'application/json']
  ]),
  async *[Symbol.asyncIterator]() {
    yield Buffer.from(JSON.stringify({
      operationType: 'backup',
      operationId: 'failback-1781345005074-42c145',
      backupName: 'failback-my-cluster-mqc6tmoi',
      phase: 'Completed',
      message: 'test',
      clusterId: 'my-cluster',
      token: 'usr_b7224d9e'
    }));
  }
};

handleRequest(mockRequest).then(console.log).catch(console.error);
