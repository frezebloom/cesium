defineSuite([
        'Scene/ClippingPlaneCollection',
        'Core/AttributeCompression',
        'Core/BoundingSphere',
        'Core/Cartesian2',
        'Core/Cartesian3',
        'Core/Cartesian4',
        'Core/Color',
        'Core/Intersect',
        'Core/Math',
        'Core/Matrix4',
        'Core/PixelFormat',
        'Core/Plane',
        'Renderer/PixelDatatype',
        'Renderer/TextureMagnificationFilter',
        'Renderer/TextureMinificationFilter',
        'Renderer/TextureWrap',
        'Scene/ClippingPlane',
        'Specs/createScene'
    ], function(
        ClippingPlaneCollection,
        AttributeCompression,
        BoundingSphere,
        Cartesian2,
        Cartesian3,
        Cartesian4,
        Color,
        Intersect,
        CesiumMath,
        Matrix4,
        PixelFormat,
        Plane,
        PixelDatatype,
        TextureMagnificationFilter,
        TextureMinificationFilter,
        TextureWrap,
        ClippingPlane,
        createScene) {
    'use strict';

    var clippingPlanes;
    var planes = [
        new ClippingPlane(Cartesian3.UNIT_X, 1.0),
        new ClippingPlane(Cartesian3.UNIT_Y, 2.0)
    ];

    var transform = new Matrix4.fromTranslation(new Cartesian3(1.0, 3.0, 2.0));
    var boundingVolume  = new BoundingSphere(Cartesian3.ZERO, 1.0);

    function decodeUint8Plane(pixel1, pixel2) {
        // expect pixel1 to be the normal
        var normal = AttributeCompression.octDecodeFromCartesian4(pixel1, new Cartesian3());

        // expect pixel2 to be the distance
        var distance = Cartesian4.unpackFloat(pixel2);
        return new Plane(normal, distance);
    }

    it('default constructor', function() {
        clippingPlanes = new ClippingPlaneCollection();
        expect(clippingPlanes._planes).toEqual([]);
        expect(clippingPlanes.enabled).toEqual(true);
        expect(clippingPlanes.modelMatrix).toEqual(Matrix4.IDENTITY);
        expect(clippingPlanes.edgeColor).toEqual(Color.WHITE);
        expect(clippingPlanes.edgeWidth).toEqual(0.0);
        expect(clippingPlanes.unionClippingRegions).toEqual(false);
        expect(clippingPlanes._testIntersection).not.toBeUndefined();
    });

    it('gets the length of the list of planes in the collection', function() {
        clippingPlanes = new ClippingPlaneCollection();

        expect(clippingPlanes.length).toBe(0);

        clippingPlanes._planes = planes.slice();

        expect(clippingPlanes.length).toBe(2);

        clippingPlanes._planes.push(new ClippingPlane(Cartesian3.UNIT_Z, -1.0));

        expect(clippingPlanes.length).toBe(3);

        clippingPlanes = new ClippingPlaneCollection({
            planes : planes
        });

        expect(clippingPlanes.length).toBe(2);
    });

    it('add adds a plane to the collection', function() {
        clippingPlanes = new ClippingPlaneCollection();
        clippingPlanes.add(planes[0]);

        expect(clippingPlanes.length).toBe(1);
        expect(clippingPlanes._planes[0]).toBe(planes[0]);
    });

    it('gets the plane at an index', function() {
        clippingPlanes = new ClippingPlaneCollection({
            planes : planes
        });

        var plane = clippingPlanes.get(0);
        expect(plane).toBe(planes[0]);

        plane = clippingPlanes.get(1);
        expect(plane).toBe(planes[1]);

        plane = clippingPlanes.get(2);
        expect(plane).toBeUndefined();
    });

    it('contain checks if the collection contains a plane', function() {
        clippingPlanes = new ClippingPlaneCollection({
            planes : planes
        });

        expect(clippingPlanes.contains(planes[0])).toBe(true);
        expect(clippingPlanes.contains(new ClippingPlane(Cartesian3.UNIT_Y, 2.0))).toBe(true);
        expect(clippingPlanes.contains(new ClippingPlane(Cartesian3.UNIT_Z, 3.0))).toBe(false);
    });

    it('remove removes and the first occurrence of a plane', function() {
        clippingPlanes = new ClippingPlaneCollection({
            planes : planes
        });

        expect(clippingPlanes.contains(planes[0])).toBe(true);

        var result = clippingPlanes.remove(planes[0]);

        expect(clippingPlanes.contains(planes[0])).toBe(false);
        expect(clippingPlanes.length).toBe(1);
        expect(clippingPlanes.get(0)).toEqual(planes[1]);
        expect(result).toBe(true);

        result = clippingPlanes.remove(planes[0]);
        expect(result).toBe(false);
    });

    describe('uint8 texture mode', function() {
        beforeEach(function() {
            spyOn(ClippingPlaneCollection, 'useFloatTexture').and.returnValue(false);
        });

        it('update creates a RGBA ubyte texture with no filtering or wrapping to house packed clipping planes', function() {
            var scene = createScene();
            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            clippingPlanes.update(scene.frameState);

            var packedTexture = clippingPlanes.texture;
            expect(packedTexture).toBeDefined();

            // Two RGBA uint8 clipping planes consume 4 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(8);
            expect(packedTexture.height).toEqual(1);

            expect(packedTexture.pixelFormat).toEqual(PixelFormat.RGBA);
            expect(packedTexture.pixelDatatype).toEqual(PixelDatatype.UNSIGNED_BYTE);

            var sampler = packedTexture.sampler;
            expect(sampler.wrapS).toEqual(TextureWrap.CLAMP_TO_EDGE);
            expect(sampler.wrapT).toEqual(TextureWrap.CLAMP_TO_EDGE);
            expect(sampler.minificationFilter).toEqual(TextureMinificationFilter.NEAREST);
            expect(sampler.magnificationFilter).toEqual(TextureMinificationFilter.NEAREST);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });

        it('update fills the clipping plane texture with packed planes', function() {
            var scene = createScene();

            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            var rgba;
            var gl = scene.frameState.context._gl;
            spyOn(gl, 'texImage2D').and.callFake(function(target, level, xoffset, yoffset, width, height, format, type, arrayBufferView) {
                rgba = arrayBufferView;
            });

            clippingPlanes.update(scene.frameState);
            expect(rgba).toBeDefined();
            expect(rgba.length).toEqual(32);

            // Expect two clipping planes to use 4 pixels in the texture, so the first 16 bytes
            for (var i = 16; i < rgba.length; i++) {
                expect(rgba[i]).toEqual(0);
            }
            var pixel1 = Cartesian4.fromArray(rgba, 0);
            var pixel2 = Cartesian4.fromArray(rgba, 4);
            var pixel3 = Cartesian4.fromArray(rgba, 8);
            var pixel4 = Cartesian4.fromArray(rgba, 12);

            var plane1 = decodeUint8Plane(pixel1, pixel2);
            var plane2 = decodeUint8Plane(pixel3, pixel4);

            expect(Cartesian3.equalsEpsilon(plane1.normal, planes[0].normal, CesiumMath.EPSILON3)).toEqual(true);
            expect(Cartesian3.equalsEpsilon(plane2.normal, planes[1].normal, CesiumMath.EPSILON3)).toEqual(true);
            expect(CesiumMath.equalsEpsilon(plane1.distance, planes[0].distance, CesiumMath.EPSILON3)).toEqual(true);
            expect(CesiumMath.equalsEpsilon(plane2.distance, planes[1].distance, CesiumMath.EPSILON3)).toEqual(true);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });

        it('reallocates textures when above capacity or below 1/4 capacity', function() {
            var scene = createScene();

            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            clippingPlanes.update(scene.frameState);

            var packedTexture = clippingPlanes.texture;

            // Two RGBA uint8 clipping planes consume 4 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(8);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));

            clippingPlanes.update(scene.frameState);

            expect(packedTexture.isDestroyed()).toBe(true);
            packedTexture = clippingPlanes.texture;

            // Five RGBA uint8 clipping planes consume 10 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(20);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.removeAll();
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));

            clippingPlanes.update(scene.frameState);

            expect(packedTexture.isDestroyed()).toBe(true);
            packedTexture = clippingPlanes.texture;

            // One RGBA uint8 clipping plane consume 2 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(4);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });
    });

    describe('float texture mode', function() {
        it('update creates a float texture with no filtering or wrapping to house packed clipping planes', function() {
            var scene = createScene();

            if (!ClippingPlaneCollection.useFloatTexture(scene._context)) {
                // Don't fail just because float textures aren't supported
                scene.destroyForSpecs();
                return;
            }

            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            clippingPlanes.update(scene.frameState);

            var packedTexture = clippingPlanes.texture;
            expect(packedTexture).toBeDefined();
            expect(packedTexture.width).toEqual(4);
            expect(packedTexture.height).toEqual(1);
            expect(packedTexture.pixelFormat).toEqual(PixelFormat.RGBA);
            expect(packedTexture.pixelDatatype).toEqual(PixelDatatype.FLOAT);

            var sampler = packedTexture.sampler;
            expect(sampler.wrapS).toEqual(TextureWrap.CLAMP_TO_EDGE);
            expect(sampler.wrapT).toEqual(TextureWrap.CLAMP_TO_EDGE);
            expect(sampler.minificationFilter).toEqual(TextureMinificationFilter.NEAREST);
            expect(sampler.magnificationFilter).toEqual(TextureMinificationFilter.NEAREST);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });

        it('update fills the clipping plane texture with packed planes', function() {
            var scene = createScene();

            if (!ClippingPlaneCollection.useFloatTexture(scene._context)) {
                // Don't fail just because float textures aren't supported
                scene.destroyForSpecs();
                return;
            }

            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            var rgba;
            var gl = scene.frameState.context._gl;
            spyOn(gl, 'texImage2D').and.callFake(function(target, level, xoffset, yoffset, width, height, format, type, arrayBufferView) {
                rgba = arrayBufferView;
            });

            clippingPlanes.update(scene.frameState);
            expect(rgba).toBeDefined();
            expect(rgba.length).toEqual(16);

            // Expect two clipping planes to use 2 pixels in the texture, so the first 8 floats.
            for (var i = 8; i < rgba.length; i++) {
                expect(rgba[i]).toEqual(0);
            }
            var plane1 = Plane.fromCartesian4(Cartesian4.fromArray(rgba, 0));
            var plane2 = Plane.fromCartesian4(Cartesian4.fromArray(rgba, 4));

            expect(Cartesian3.equalsEpsilon(plane1.normal, planes[0].normal, CesiumMath.EPSILON3)).toEqual(true);
            expect(Cartesian3.equalsEpsilon(plane2.normal, planes[1].normal, CesiumMath.EPSILON3)).toEqual(true);
            expect(CesiumMath.equalsEpsilon(plane1.distance, planes[0].distance, CesiumMath.EPSILON3)).toEqual(true);
            expect(CesiumMath.equalsEpsilon(plane2.distance, planes[1].distance, CesiumMath.EPSILON3)).toEqual(true);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });

        it('reallocates textures when above capacity or below 1/4 capacity', function() {
            var scene = createScene();

            if (!ClippingPlaneCollection.useFloatTexture(scene._context)) {
                // Don't fail just because float textures aren't supported
                scene.destroyForSpecs();
                return;
            }

            clippingPlanes = new ClippingPlaneCollection({
                planes : planes,
                enabled : false,
                edgeColor : Color.RED,
                modelMatrix : transform
            });

            clippingPlanes.update(scene.frameState);

            var packedTexture = clippingPlanes.texture;

            // Two RGBA float clipping planes consume 2 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(4);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));

            clippingPlanes.update(scene.frameState);

            expect(packedTexture.isDestroyed()).toBe(true);
            packedTexture = clippingPlanes.texture;

            // Five RGBA float clipping planes consume 5 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(10);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.removeAll();
            clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 1.0));

            clippingPlanes.update(scene.frameState);

            expect(packedTexture.isDestroyed()).toBe(true);
            packedTexture = clippingPlanes.texture;

            // One RGBA float clipping plane consume 1 pixels of texture, allocation to be double that
            expect(packedTexture.width).toEqual(2);
            expect(packedTexture.height).toEqual(1);

            clippingPlanes.destroy();
            scene.destroyForSpecs();
        });
    });

    it('does not perform texture updates if the planes are unchanged', function() {
        var scene = createScene();

        var gl = scene.frameState.context._gl;
        spyOn(gl, 'texImage2D').and.callThrough();

        clippingPlanes = new ClippingPlaneCollection({
            planes : planes,
            enabled : false,
            edgeColor : Color.RED,
            modelMatrix : transform
        });
        expect(gl.texImage2D.calls.count()).toEqual(0);

        clippingPlanes.update(scene.frameState);
        expect(gl.texImage2D.calls.count()).toEqual(2);

        clippingPlanes.update(scene.frameState);
        expect(gl.texImage2D.calls.count()).toEqual(2);

        clippingPlanes.destroy();
        scene.destroyForSpecs();
    });

    it('provides a function for attaching the ClippingPlaneCollection to objects', function() {
        var clippedObject1 = {
            clippingPlanes : undefined
        };
        var clippedObject2 = {
            clippingPlanes : undefined
        };

        var clippingPlanes1 = new ClippingPlaneCollection({
            planes : planes,
            enabled : false,
            edgeColor : Color.RED,
            modelMatrix : transform
        });

        ClippingPlaneCollection.setOwner(clippingPlanes1, clippedObject1, 'clippingPlanes');
        expect(clippedObject1.clippingPlanes).toBe(clippingPlanes1);
        expect(clippingPlanes1._owner).toBe(clippedObject1);

        var clippingPlanes2 = new ClippingPlaneCollection({
            planes : planes,
            enabled : false,
            edgeColor : Color.RED,
            modelMatrix : transform
        });

        // Expect detached clipping planes to be destroyed
        ClippingPlaneCollection.setOwner(clippingPlanes2, clippedObject1, 'clippingPlanes');
        expect(clippingPlanes1.isDestroyed()).toBe(true);

        // Expect setting the same ClippingPlaneCollection again to not destroy the ClippingPlaneCollection
        ClippingPlaneCollection.setOwner(clippingPlanes2, clippedObject1, 'clippingPlanes');
        expect(clippingPlanes2.isDestroyed()).toBe(false);

        // Expect failure when attaching one ClippingPlaneCollection to two objects
        expect(function() {
            ClippingPlaneCollection.setOwner(clippingPlanes2, clippedObject2, 'clippingPlanes');
        }).toThrowDeveloperError();
    });

    it('clone without a result parameter returns new copy', function() {
        clippingPlanes = new ClippingPlaneCollection({
            planes : planes,
            enabled : false,
            edgeColor : Color.RED,
            modelMatrix : transform
        });

        var result = clippingPlanes.clone();
        expect(result).not.toBe(clippingPlanes);
        expect(Cartesian3.equals(result._planes[0].normal, planes[0].normal)).toBe(true);
        expect(result._planes[0].distance).toEqual(planes[0].distance);
        expect(Cartesian3.equals(result._planes[1].normal, planes[1].normal)).toBe(true);
        expect(result._planes[1].distance).toEqual(planes[1].distance);
        expect(result.enabled).toEqual(false);
        expect(result.modelMatrix).toEqual(transform);
        expect(result.edgeColor).toEqual(Color.RED);
        expect(result.edgeWidth).toEqual(0.0);
        expect(result.unionClippingRegions).toEqual(false);
        expect(result._testIntersection).not.toBeUndefined();
    });

    it('clone stores copy in result parameter', function() {
        clippingPlanes = new ClippingPlaneCollection({
            planes : planes,
            enabled : false,
            edgeColor : Color.RED,
            modelMatrix : transform
        });
        var result = new ClippingPlaneCollection();
        var copy = clippingPlanes.clone(result);
        expect(copy).toBe(result);
        expect(result._planes).not.toBe(planes);
        expect(Cartesian3.equals(result._planes[0].normal, planes[0].normal)).toBe(true);
        expect(result._planes[0].distance).toEqual(planes[0].distance);
        expect(Cartesian3.equals(result._planes[1].normal, planes[1].normal)).toBe(true);
        expect(result._planes[1].distance).toEqual(planes[1].distance);
        expect(result.enabled).toEqual(false);
        expect(result.modelMatrix).toEqual(transform);
        expect(result.edgeColor).toEqual(Color.RED);
        expect(result.edgeWidth).toEqual(0.0);
        expect(result.unionClippingRegions).toEqual(false);
        expect(result._testIntersection).not.toBeUndefined();

        // Only allocate a new array if needed
        var previousPlanes = result._planes;
        clippingPlanes.clone(result);
        expect(result._planes).toBe(previousPlanes);
    });

    it('setting unionClippingRegions updates testIntersection function', function() {
        clippingPlanes = new ClippingPlaneCollection();
        var originalIntersectFunction = clippingPlanes._testIntersection;

        expect(clippingPlanes._testIntersection).not.toBeUndefined();

        clippingPlanes.unionClippingRegions = true;

        expect(clippingPlanes._testIntersection).not.toBe(originalIntersectFunction);
    });

    it('computes intersections with bounding volumes when clipping regions are combined with an intersect operation', function() {
        clippingPlanes = new ClippingPlaneCollection();

        var intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, -2.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.OUTSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_Y, 0.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INTERSECTING);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_Z, 1.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_Z, 0.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INSIDE);
    });

    it('computes intersections with bounding volumes when clipping planes are combined with a union operation', function() {
        clippingPlanes = new ClippingPlaneCollection({
            unionClippingRegions : true
        });

        var intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_Z, 1.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INSIDE);

        var temp = new ClippingPlane(Cartesian3.UNIT_Y, -2.0);
        clippingPlanes.add(temp);
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.OUTSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, 0.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.OUTSIDE);

        clippingPlanes.remove(temp);
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume);
        expect(intersect).toEqual(Intersect.INTERSECTING);
    });

    it('compute intersections applies optional transform to planes', function() {
        clippingPlanes = new ClippingPlaneCollection();

        var intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume, transform);
        expect(intersect).toEqual(Intersect.INSIDE);

        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, -1.0));
        intersect = clippingPlanes.computeIntersectionWithBoundingVolume(boundingVolume, transform);
        expect(intersect).not.toEqual(Intersect.INSIDE);
    });

    it('computes a description of the current shader for comparison', function() {
        clippingPlanes = new ClippingPlaneCollection();
        clippingPlanes.add(new ClippingPlane(Cartesian3.UNIT_X, -1.0));

        expect(clippingPlanes.clippingPlanesState).toEqual(-1);

        var holdThisPlane = new ClippingPlane(Cartesian3.UNIT_X, -1.0);
        clippingPlanes.add(holdThisPlane);
        expect(clippingPlanes.clippingPlanesState).toEqual(-2);

        clippingPlanes.unionClippingRegions = true;
        expect(clippingPlanes.clippingPlanesState).toEqual(2);

        clippingPlanes.remove(holdThisPlane);
        expect(clippingPlanes.clippingPlanesState).toEqual(1);
    });
});
