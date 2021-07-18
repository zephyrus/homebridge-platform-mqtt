const { Failure } = require('./failure');

const millisec = (time = 5) => new Promise((resolve) => setTimeout(resolve, time));

describe('state/failure', () => {

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should be class', () => {
		expect(typeof Failure).toBe('function');
		expect(typeof Failure.prototype).toBe('object');
	});

	it('should have `get` method', () => {
		const a = new Failure();

		expect(typeof a.get).toBe('function');
		expect(a.get()).toEqual(false);
	});

	it('should have `clear`/`watch` methods', async () => {
		const a = new Failure(10);

		expect(a.get()).toEqual(false);
		a.watch();
		await millisec(20);

		expect(a.get()).toEqual(true);
		a.clear();
		expect(a.get()).toEqual(false);

		a.watch();
		await millisec(5);
		a.clear();

		expect(a.get()).toEqual(false);
		await millisec(30);

		expect(a.get()).toEqual(false);
	});

	it('should not start timer once no delay passed', () => {
		const a = new Failure();

		a.watch();

		expect(a.get()).toEqual(false);
		expect(a.timer).toEqual(undefined);
	});

	it('should not clear timer once not started', () => {
		const a = new Failure(10);

		a.set(true);
		expect(a.get()).toEqual(true);

		a.clear();

		expect(a.get()).toEqual(false);
		expect(a.timer).toEqual(undefined);
	});

});
