const uniqid = require('uniqid');

class Tree {
    constructor() {
        this.items = {};
    }

    getItem(itemId) {
        if (typeof itemId !== 'string') {
            throw new Error('Id should be a string value');
        }

        return this.items[itemId];
    }

    getChildren(itemId) {
        const item = this.getItem(itemId);
        if (!item) {
            return [];
        }

        if (!item.children.length) {
            return [];
        }

        return item.children.map(childId => this.getItem(childId));
    }

    addItem(item, parentId) {
        if (!item) {
            throw new Error('Cannot to add undefined item');
        }

        if (typeof item !== 'object') {
            throw new Error('Cannot to add a non-object item');
        }

        const id = uniqid();
        Object.assign(
            item,
            {
                id,
                children: [],
            },
        );
        this.items[id] = item;

        if (parentId) {
            const parentItem = this.getItem(parentId);
            if (!parentItem) {
                throw new Error(`There is no such parent element with id ${parentId}`);
            }
            parentItem.children.push(item.id);
        }
        return item;
    }
}

module.exports = Tree;
