var fs = require('fs')
const Buffer = require('buffer').Buffer;
const Readable = require('stream').Readable;

const scaleBuffer = function(qrBuffer, qrWidth, qrHeight, scaleFactor) {
	// Calculate new dimensions
	const newWidth = Math.floor(qrWidth * scaleFactor);
	const newHeight = Math.floor(qrHeight * scaleFactor);

	// Create a new buffer for the scaled image
	const scaledBuffer = Buffer.alloc(newWidth * newHeight * 2); // RGB565 format (2 bytes per pixel)

	// Function to get RGB565 pixel value from buffer
	const getPixel = (buffer, width, x, y) => {
		const idx = (y * width + x) * 2;
		return buffer.readUInt16LE(idx);
	};

	// Scale the buffer
	for (let y = 0; y < newHeight; y++) {
		for (let x = 0; x < newWidth; x++) {
			// Find corresponding pixel in the original buffer
			const origX = Math.floor(x / scaleFactor);
			const origY = Math.floor(y / scaleFactor);

			// Get pixel from the original buffer
			const pixel = getPixel(qrBuffer, qrWidth, origX, origY);

			// Set pixel in the scaled buffer
			const scaledIdx = (y * newWidth + x) * 2;
			scaledBuffer.writeUInt16LE(pixel, scaledIdx);
		}
	}

	return scaledBuffer;
}

const centerFB = function(qrBuffer) {
	// Define dimensions
	const qrWidth = Math.sqrt(qrBuffer.length / 2);	// Example QR code width
	const qrHeight = Math.sqrt(qrBuffer.length / 2);   // Example QR code height
	const fbWidth = 320;
	const fbHeight = 240;

	// Create buffers for QR code and framebuffer
	//const qrBuffer = Buffer.alloc(qrWidth * qrHeight * 2); // RGB565 format (2 bytes per pixel)
	const framebufferBuffer = Buffer.alloc(fbWidth * fbHeight * 2); // RGB565 format (2 bytes per pixel)

	// Fill qrBuffer with QR code pixel data (Replace with actual data)
	// Example: Fill with a pattern or load from an actual QR code
	// This example assumes qrBuffer is already populated with RGB565 data

	// Function to convert an RGB565 pixel to RGB565 format
	function rgbToRgb565(r, g, b) {
		return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
	}

	// Define the blue color in RGB565 format
	const blueRgb565 = rgbToRgb565(0, 0, 255);

	// Fill framebuffer with blue background
	for (let i = 0; i < fbWidth * fbHeight; i++) {
		framebufferBuffer.writeUInt16LE(blueRgb565, i * 2);
	}

	// Calculate position to center QR code
	const xOffset = Math.floor((fbWidth - qrWidth) / 2);
	const yOffset = Math.floor((fbHeight - qrHeight) / 2);

	// Copy QR code pixels to framebuffer
	for (let y = 0; y < qrHeight; y++) {
		for (let x = 0; x < qrWidth; x++) {
			const qrIdx = (qrWidth * y + x) * 2;
			const pixel = qrBuffer.readUInt16LE(qrIdx); // Read RGB565 pixel from qrBuffer

			// Calculate destination index in framebuffer
			const fbIdx = ((y + yOffset) * fbWidth + (x + xOffset)) * 2;

			framebufferBuffer.writeUInt16LE(pixel, fbIdx); // Write RGB565 pixel to framebuffer
		}
	}

	return framebufferBuffer;
}

exports.render = function (qrData, options, cb) {
	var size = qrData.modules.size;
	var data = qrData.modules.data;
	var scale = options.scale ? options.scale : 1;

	// Define the colors in RGB565 format, little-endian byte order
	const green = Buffer.from([0xE0, 0x07]); // Originally black, now green
	const red = Buffer.from([0x00, 0xF8]); // Originally white, now red
	const white = Buffer.from([0xFF, 0xFF]); // White in little-endian (0xFFFF)
	const black = Buffer.from([0x00, 0x00]); // Black in little-endian (0x0000)

	// Create a framebuffer buffer
	var framebuffer = Buffer.alloc(size * size * 2); // Each pixel takes 2 bytes in RGB565
	for (var i = 0; i < size; ++i) {
		for (var j = 0; j < size; j++) {
			var pos = (i * size + j) * 2; // Position in framebuffer buffer
			if (data[i * size + j]) {
				//green.copy(framebuffer, pos); // Set pixel to green
				black.copy(framebuffer, pos); // Set pixel to black
			} else {
				//red.copy(framebuffer, pos); // Set pixel to red
				white.copy(framebuffer, pos); // Set pixel to white 
			}
		}
	}

	// Scale the QR 
	const qrSize = Math.sqrt(framebuffer.length / 2);
	framebuffer = scaleBuffer(framebuffer, qrSize, qrSize, scale);

	// Add the QR to the 320*240 framebuffer centered
	framebuffer = centerFB(framebuffer);

	if (typeof cb === 'function') {
		cb(null, framebuffer);
	}

	return framebuffer;
};

exports.renderToFile = function renderToFile (path, qrData, options, cb) {
	if (typeof cb === 'undefined') {
		cb = options
		options = undefined
	}

	var stream = fs.createWriteStream(path)
	stream.on('error', cb)
	stream.on('close', cb)

	exports.renderToFileStream(stream, qrData, options)
}

exports.renderToFileStream = function renderToFileStream (stream, qrData, options) {
	var fb = exports.render(qrData, options)

	const readableStream = new Readable({
		read() {
			this.push(fb);
			this.push(null);	// Indicates that the stream has reached its end
		}
	});

	readableStream.pipe(stream);
}
