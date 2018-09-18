define([
        '../Core/Intersect',
        '../Core/ManagedArray',
        './Cesium3DTileRefine'
    ], function(
        Intersect,
        ManagedArray,
        Cesium3DTileRefine) {
    'use strict';

    /**
     * @private
     */
    function Cesium3DTilesetOffscreenTraversal() {
    }

    var offscreenTraversal = {
        stack : new ManagedArray(),
        stackMaximumLength : 0
    };

    Cesium3DTilesetOffscreenTraversal.selectTilesOffscreen = function(tileset, minimumGeometricError, frameState) {
        tileset._offscreenTiles.length = 0;

        var root = tileset.root;
        root.updateVisibility(frameState);

        if (!isVisible(root)) {
            return;
        }

        if (root._geometricError <= minimumGeometricError) {
            return;
        }

        executeTraversal(tileset, minimumGeometricError, frameState);

        offscreenTraversal.stack.trim(offscreenTraversal.stackMaximumLength);
    };

    function isVisible(tile) {
        return tile._visible && tile._inRequestVolume;
    }

    function hasEmptyContent(tile) {
        return tile.hasEmptyContent || tile.hasTilesetContent;
    }

    function hasUnloadedContent(tile) {
        return !hasEmptyContent(tile) && tile.contentUnloaded;
    }

    function canTraverse(tileset, minimumGeometricError, tile) {
        if (tile.children.length === 0) {
            return false;
        }

        if (tile.hasTilesetContent) {
            // Traverse external tileset to visit its root tile
            // Don't traverse if the subtree is expired because it will be destroyed
            return !tile.contentExpired;
        }

        if (tile.hasEmptyContent) {
            return true;
        }

        return tile._geometricError >= minimumGeometricError;
    }

    function updateAndPushChildren(tileset, tile, stack, frameState) {
        var children = tile.children;
        var length = children.length;

        var refines = false;
        for (var i = 0; i < length; ++i) {
            var child = children[i];
            child.updateVisibility(frameState);
            if (isVisible(child)) {
                stack.push(child);
                refines = true;
            }
        }
        return refines;
    }

    function loadTile(tileset, tile) {
        if (hasUnloadedContent(tile) || tile.contentExpired) {
            tileset._requestedOffscreenTiles.push(tile);
        }
    }

    function executeTraversal(tileset, minimumGeometricError, frameState) {
        var stack = offscreenTraversal.stack;
        stack.push(tileset.root);

        while (stack.length > 0) {
            offscreenTraversal.stackMaximumLength = Math.max(offscreenTraversal.stackMaximumLength, stack.length);

            var tile = stack.pop();
            var add = tile.refine === Cesium3DTileRefine.ADD;
            var replace = tile.refine === Cesium3DTileRefine.REPLACE;
            var refines = false;

            if (canTraverse(tileset, minimumGeometricError, tile, frameState)) {
                refines = updateAndPushChildren(tileset, tile, stack, frameState);
            }

            if (add || (replace && !refines)) {
                loadTile(tileset, tile);
                if (!hasEmptyContent(tile) && tile.contentAvailable) {

                }
                if (tile.contentAvailable && (tile.contentVisibility(frameState) !== Intersect.OUTSIDE)) {
                    tileset._selectedOffscreenTiles.push(tile);
                }
            }

            tileset._offscreenCache.touch(tile);
        }
    }

    return Cesium3DTilesetOffscreenTraversal;
});
