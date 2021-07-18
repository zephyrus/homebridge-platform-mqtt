const { EventEmitter } = require('events');
const { mqttState } = require('./mqtt');
const { syncState } = require('./sync');

const mockPlatform = (platform) => ({
	ready: true,
	subscribe: jest.fn(),
	publish: jest.fn(),
	log: {
		info: jest.fn(),
		warn: jest.fn(),
	},
	...platform,
});

const millisec = (time = 5) => new Promise((resolve) => setTimeout(resolve, time));

describe('state/mqtt', () => {

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should be class', () => {
		expect(typeof mqttState).toBe('function');
		expect(typeof mqttState.prototype).toBe('object');
	});

	it('should extend EventEmitter/syncState', () => {
		const a = new mqttState();
		expect(a instanceof EventEmitter).toBe(true);
		expect(a instanceof syncState).toBe(true);
	});

	it('should support creation without configuration', () => {
		const platform = mockPlatform();

		const a = new mqttState(platform);
		expect(a.data).toEqual({});
		expect(a.get()).toEqual({});

		const b = new mqttState(platform, {});
		expect(b.data).toEqual({});
		expect(b.get()).toEqual({});
	});

	it('should support creation with broken configuration', () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{},
			],
		});
		expect(a.data).toEqual({});
		expect(a.get()).toEqual({});
	});

	it('should support debug logging', () => {
		const platform1 = mockPlatform({
			config: {
				debug: 1,
			},
		});

		const a = new mqttState(platform1);
		a.debug('test');

		expect(platform1.log.info).toBeCalled();

		const platform2 = mockPlatform();

		const b = new mqttState(platform2, {
			debug: true,
		});
		b.debug('test');
		expect(platform2.log.info).toBeCalled();

		const platform3 = mockPlatform({ log: undefined });

		const c = new mqttState(platform3, {
			debug: true,
		});

		expect(() => c.debug('test')).not.toThrow();
	});

	it('should support `subscribe` configuration', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{
					subscribe: 'test',
				},
			],
		});

		expect(platform.subscribe).toBeCalled();
		expect(platform.subscribe.mock.calls[0][0]).toBe('test');
		expect(a.get()).toEqual({});

		platform.subscribe.mock.calls[0][1]('test', { a: 1 });

		await millisec();
		expect(a.get()).toEqual({ a: 1 });

		platform.subscribe.mock.calls[0][1]('test', { b: 2 });

		await millisec();
		expect(a.get()).toEqual({ b: 2 });
	});

	it('should support sync `subscribe` handlers', async () => {
		const platform = mockPlatform();

		const sync = new mqttState(platform, {
			topics: [
				{
					subscribe: 'test',
					handle: (a) => ({ ...a, test: 1 }),
				},
			],
		});

		expect(platform.subscribe).toBeCalled();
		expect(platform.subscribe.mock.calls[0][0]).toBe('test');
		expect(sync.get()).toEqual({});

		platform.subscribe.mock.calls[0][1]('test', { a: 1 });

		await millisec();
		expect(sync.get()).toEqual({ a: 1, test: 1 });
	});

	it('should support async `subscribe` handlers', async () => {
		const platform = mockPlatform();

		const sync = new mqttState(platform, {
			topics: [
				{
					subscribe: 'test',
					handle: async (a) => {
						await millisec(5);
						return { ...a, test: 2 };
					},
				},
			],
		});

		expect(platform.subscribe).toBeCalled();
		expect(platform.subscribe.mock.calls[0][0]).toBe('test');
		expect(sync.get()).toEqual({});

		platform.subscribe.mock.calls[0][1]('test', { a: 1 });

		await millisec(10);
		expect(sync.get()).toEqual({ a: 1, test: 2 });
	});

	it('should support keys in `subscribe` handlers', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{
					subscribe: 'test',
					key: 'b',
					handle: (b) => ({ ...b, test: 2 }),
				},
			],
		});

		expect(platform.subscribe).toBeCalled();
		expect(platform.subscribe.mock.calls[0][0]).toBe('test');
		expect(a.get()).toEqual({ b: {} });

		platform.subscribe.mock.calls[0][1]('test', { a: 1 });

		await millisec();
		expect(a.get()).toEqual({ b: { a: 1, test: 2 } });
	});

	it('should support `publish` configuration', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({});

		a.update({ a: 1 });
		await millisec();

		// expect actual state not to change till confirmation
		expect(a.get()).toEqual({ a: 1 });
		expect(a.publish).toBeCalled();
		expect(a.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ a: 1 },
		]);
		expect(platform.publish).toBeCalled();
	});

	it('should should not `publish` until platform is ready', async () => {
		const platform = mockPlatform({ ready: false });

		const a = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({});

		a.update({ a: 1 });
		await millisec();

		expect(a.get()).toEqual({ a: 1 });
		expect(a.publish).toBeCalled();
		expect(platform.publish).not.toBeCalled();

		platform.ready = true;

		a.update({ a: 2 });
		await millisec();

		expect(a.get()).toEqual({ a: 2 });
		expect(a.publish).toBeCalledTimes(2);
		expect(platform.publish).toBeCalled();
	});

	it('should should not `publish` if handler returned `undefined`', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
					handle: () => undefined,
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({});

		a.update({ a: 1 });
		await millisec();

		expect(a.get()).toEqual({ a: 1 });
		expect(a.publish).toBeCalled();
		expect(platform.publish).not.toBeCalled();
	});

	it('should support sync `publish` handlers', async () => {
		const platform = mockPlatform();

		const sync = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
					handle: (a) => ({ ...a, test: 1 }),
				},
			],
		});

		sync.update({ a: 1 });
		await millisec();

		expect(platform.publish).toBeCalled();
		expect(platform.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ a: 1, test: 1 },
		]);

		sync.update({ a: 2 });
		await millisec();

		expect(platform.publish).toBeCalledTimes(2);
		expect(platform.publish.mock.calls[1].slice(0, 2)).toEqual([
			'test',
			{ a: 2, test: 1 },
		]);
	});

	it('should support async `publish` handlers', async () => {
		const platform = mockPlatform();

		const async = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
					handle: async (a) => {
						await millisec(5);
						return { ...a, test: 2 };
					},
				},
			],
		});

		async.update({ a: 1 });
		await millisec(10);

		expect(platform.publish).toBeCalled();
		expect(platform.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ a: 1, test: 2 },
		]);

		async.update({ a: 2 });
		await millisec(10);

		expect(platform.publish).toBeCalledTimes(2);
		expect(platform.publish.mock.calls[1].slice(0, 2)).toEqual([
			'test',
			{ a: 2, test: 2 },
		]);
	});

	it('should support keys in `publish` handlers', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			topics: [
				{
					publish: 'test',
					key: 'b',
					handle: (b) => ({ ...b, test: 3 }),
				},
			],
		});

		a.update({ b: { c: 4 } });
		await millisec(10);

		expect(platform.publish).toBeCalled();
		expect(platform.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ c: 4, test: 3 },
		]);

		a.update({ b: { c: 5 } });
		await millisec();

		expect(platform.publish).toBeCalled();
		expect(platform.publish.mock.calls[1].slice(0, 2)).toEqual([
			'test',
			{ c: 5, test: 3 },
		]);
	});

	it('should support `publish` confirmation message', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			confirm: true,
			topics: [
				{
					subscribe: 'test',
				},
				{
					publish: 'test',
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({});

		a.update({ a: 1 });
		await millisec();

		// expect actual state not to change till confirmation
		expect(a.get()).toEqual({});
		expect(a.publish).toBeCalled();
		expect(a.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ a: 1 },
		]);
		expect(platform.publish).toBeCalled();

		// send confirmation
		platform.subscribe.mock.calls[0][1]('test', { a: 2 });
		await millisec();

		expect(a.get()).toEqual({ a: 2 });
	});

	it('should support `publish` confirmation failure', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			confirm: 10,
			topics: [
				{
					subscribe: 'test',
				},
				{
					publish: 'test',
				},
			],
		});

		jest.spyOn(a, 'publish');
		jest.spyOn(a, 'emit');

		expect(a.get()).toEqual({});

		a.update({ a: 1 });
		await millisec();

		// expect actual state not to change till confirmation
		expect(a.get()).toEqual({});
		expect(a.publish).toBeCalled();
		expect(a.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ a: 1 },
		]);
		expect(platform.publish).toBeCalled();
		expect(a.failed).toBe(false);
		await millisec(20);

		expect(a.failed).toBe(true);
		expect(a.emit).toBeCalledTimes(2);
		expect(a.emit.mock.calls[0].slice(0, 2)).toEqual(['update', { a: 1 }]);
		expect(a.emit.mock.calls[1]).toEqual(['status', true]);

		// send confirmation
		platform.subscribe.mock.calls[0][1]('test', { a: 2 });
		await millisec(10);

		expect(a.get()).toEqual({ a: 2 });
		expect(a.failed).toBe(false);
		expect(a.emit).toBeCalledTimes(4);
		expect(a.emit.mock.calls[2].slice(0, 2)).toEqual(['change', { a: 2 }]);
		expect(a.emit.mock.calls[3]).toEqual(['status', false]);
	});

	it('should support keys in `publish` confirmation message', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			confirm: true,
			topics: [
				{
					subscribe: 'test',
					key: 'b',
				},
				{
					publish: 'test',
					key: 'b',
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({ b: {} });

		a.update({ a: 1, b: { c: 2 } });
		await millisec();

		// expect actual state not to change till confirmation
		expect(a.get()).toEqual({ b: {} });
		expect(a.publish).toBeCalled();
		expect(a.publish.mock.calls[0].slice(0, 2)).toEqual([
			'test',
			{ c: 2 },
		]);
		expect(platform.publish).toBeCalled();

		// send confirmation
		platform.subscribe.mock.calls[0][1]('test', { c: 3 });
		await millisec();

		expect(a.get()).toEqual({ b: { c: 3 } });
	});

	it('should support keys in `publish` confirmation message', async () => {
		const platform = mockPlatform();

		const a = new mqttState(platform, {
			confirm: true,
			topics: [
				{
					subscribe: 'test',
					key: 'b',
				},
				{
					publish: 'test',
					key: 'b',
				},
			],
		});

		jest.spyOn(a, 'publish');

		expect(a.get()).toEqual({ b: {} });

		a.update({ a: 1, b: { c: 2 } });
		await millisec();

		// expect actual state not to change till confirmation
		expect(a.get()).toEqual({ b: {} });
		expect(a.publish).toBeCalledTimes(1);

		// send confirmation
		platform.subscribe.mock.calls[0][1]('test', { c: 3 });
		await millisec();

		expect(a.get()).toEqual({ b: { c: 3 } });

		a.update({ a: 2, b: { c: 3 } });
		await millisec();

		// do not sent noop updates
		expect(a.publish).toBeCalledTimes(1);
	});

});
