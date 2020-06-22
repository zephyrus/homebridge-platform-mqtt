module.exports = {

	default: {
		encode: (v) => v,
		decode: (v) => v,
	},

	boolean: {
		encode: (v) => (v ? 1 : 0),
		decode: (v) => !!v,
	},

	integer: {
		encode: (v) => parseInt(v, 10),
		decode: (v) => parseInt(v, 10),
	},

	float: {
		encode: (v) => parseFloat(v),
		decode: (v) => parseFloat(v),
	},

};
