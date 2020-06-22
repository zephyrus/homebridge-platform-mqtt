const { EventEmitter } = require('events');
const { State } = require('./state');

describe('State', () => {

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should be class', () => {
		expect(typeof State).toBe('function');
		expect(typeof State.prototype).toBe('object');
	});

	it('should extend EventEmitter', () => {
		const a = new State();
		expect(a instanceof EventEmitter).toBe(true);
	});

	it('should have `get` method', () => {
		const a = new State({ a: 1 });

		expect(typeof a.get).toBe('function');
		expect(a.get()).toEqual({ a: 1 });
	});

	it('should have method to replace data', () => {
		const a = new State({ a: { b: 2 } });
		a.emit = jest.fn();

		a.set({ b: 2 });

		expect(a.emit.mock.calls.length).toBe(1);
		expect(a.emit.mock.calls[0]).toEqual(['change', {
			b: 2,
		}, {
			a: {
				b: 2,
			},
		}]);
	});

	it('should ignore noop changes', () => {
		const a = new State({ a: 1 });
		a.emit = jest.fn();

		a.merge({ a: 1 });

		expect(a.emit.mock.calls.length).toBe(0);
	});

	it('should ignore noop deep changes', () => {
		const a = new State({ a: { b: 1 } });
		a.emit = jest.fn();

		a.merge({ a: { b: 1 } });

		expect(a.emit.mock.calls.length).toBe(0);
	});

	it('should emit `change` event for actual change', () => {
		const a = new State({ a: 1 });
		a.emit = jest.fn();

		a.merge({ b: 1 });

		expect(a.emit.mock.calls.length).toBe(1);
		expect(a.emit.mock.calls[0]).toEqual(['change', {
			a: 1,
			b: 1,
		}, {
			a: 1,
		}]);
	});

	it('should emit `change` event for actual deep change', () => {
		const a = new State({ a: { b: 1 } });
		a.emit = jest.fn();

		a.merge({ a: { c: 2 } });

		expect(a.emit.mock.calls.length).toBe(1);
		expect(a.emit.mock.calls[0]).toEqual(['change', {
			a: {
				b: 1,
				c: 2,
			},
		}, {
			a: {
				b: 1,
			},
		}]);
	});

	it('should provide immutable data in events', () => {
		const a = new State({ a: 1 });

		a.on('change', (data) => {
			data.a = 3;

			expect(data.a).toBe(3);
			expect(a.data.a).toBe(2);
		});

		a.merge({ a: 2 });
	});

	it('should allow link to other state', () => {
		const a = new State({ a: 1 });
		const b = new State();

		b.emit = jest.fn();

		a.link(b);

		expect(b.emit.mock.calls.length).toBe(1);
		expect(b.emit.mock.calls[0]).toEqual(['change', {
			a: 1,
		}, {}]);

		a.set({ b: 2 });

		expect(b.emit.mock.calls.length).toBe(2);
		expect(b.emit.mock.calls[1]).toEqual(['change', {
			b: 2,
		}, {
			a: 1,
		}]);
	});

	it('should allow link to other state with conversion', () => {
		const a = new State({ a: 1 });
		const b = new State();
		b.emit = jest.fn();

		a.link(b, (data) => ({ a: data.a + 10 }));

		expect(b.emit.mock.calls.length).toBe(1);
		expect(b.emit.mock.calls[0]).toEqual(['change', {
			a: 11,
		}, {}]);
	});

	it('should allow two-way link to other state with conversion', () => {
		const a = new State({ a: 1 });
		const b = new State({ b: 10 });

		a.link(b, (data) => ({ b: data.a + 10 }));
		b.link(a, (data) => ({ a: data.b - 10 }));

		a.set({ a: 5 });

		expect(b.data).toEqual({ b: 15 });

		b.set({ b: 25 });

		expect(a.data).toEqual({ a: 15 });
	});

});
