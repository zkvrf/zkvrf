// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9;

library Sets {
    struct Set {
        mapping(bytes32 => bytes32) ll;
        uint256 size;
    }

    bytes32 public constant OUROBOROS = bytes32(uint256(1));

    function init(Set storage set) internal {
        require(set.ll[OUROBOROS] == bytes32(0));
        set.ll[OUROBOROS] = OUROBOROS;
    }

    function tail(Set storage set) internal view returns (bytes32) {
        bytes32 t = set.ll[OUROBOROS];
        require(
            t != bytes32(0) && t != OUROBOROS,
            "Uninitialised or empty set"
        );
        return t;
    }

    function prev(
        Set storage set,
        bytes32 element
    ) internal view returns (bytes32) {
        require(element != bytes32(0), "Element must be nonzero");
        return set.ll[element];
    }

    function add(Set storage set, bytes32 element) internal {
        require(
            element != bytes32(0) &&
                element != OUROBOROS &&
                set.ll[element] == bytes32(0)
        );
        set.ll[element] = set.ll[OUROBOROS];
        set.ll[OUROBOROS] = element;
        ++set.size;
    }

    function del(
        Set storage set,
        bytes32 prevElement,
        bytes32 element
    ) internal {
        require(
            element == set.ll[prevElement],
            "prevElement is not linked to element"
        );
        require(
            element != bytes32(0) && element != OUROBOROS,
            "Invalid element"
        );
        set.ll[prevElement] = set.ll[element];
        set.ll[element] = bytes32(0);
        --set.size;
    }

    function has(
        Set storage set,
        bytes32 element
    ) internal view returns (bool) {
        return set.ll[element] != bytes32(0);
    }

    function toArray(Set storage set) internal view returns (bytes32[] memory) {
        if (set.size == 0) {
            return new bytes32[](0);
        }

        bytes32[] memory array = new bytes32[](set.size);
        bytes32 element = set.ll[OUROBOROS];
        for (uint256 i; i < array.length; ++i) {
            array[i] = element;
            element = set.ll[element];
        }
        return array;
    }
}
