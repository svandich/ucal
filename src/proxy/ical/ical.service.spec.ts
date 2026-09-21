import { Test, TestingModule } from '@nestjs/testing';
import { ICalService } from './ical.service';
import { UCursosProxyService } from '../ucursos/ucursos-proxy.service';

describe('ICalService', () => {
  let service: ICalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ICalService,
        { provide: UCursosProxyService, useValue: { proxyRequest: jest.fn() } },
      ],
    }).compile();

    service = module.get<ICalService>(ICalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
