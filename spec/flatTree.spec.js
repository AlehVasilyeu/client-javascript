const Tree = require('../lib/flatTree');


describe('Tree', () => {
    describe('constructor', () => {
        it('creates object with with empty tree', () => {
            const tree = new Tree();

            expect(typeof tree.tree === 'object').toBeTruthy();
            expect(Object.keys(tree.tree).length).toEqual(0);
        });
    });

    describe('#getItem', () => {
        it('returns item by id', () => {
            const tree = new Tree();
            const item = {
                id: '123',
                data: 'Item',
                children: ['321'],
            };
            tree.tree['123'] = item;

            expect(tree.getItem('123')).toEqual(item);
        });

        it('returns undefined if item is not present', () => {
            const tree = new Tree();

            expect(tree.getItem('123')).toBeUndefined();
        });

        it('throws error if non-string passed as an id', () => {
            const tree = new Tree();

            expect(() => tree.getItem(123)).toThrowError(Error, 'Id should be a string value');
        });
    });

    describe('#getChildren', () => {
        it('returns all children by item id', () => {
            const tree = new Tree();
            const parentItem = {
                data: 'Parent',
            };
            const item1 = {
                data: 'Item 1',
            };
            const item2 = {
                data: 'Item 2',
            };

            const addedParent = tree.addItem(parentItem);
            const addedItem1 = tree.addItem(item1, addedParent.id);
            const addedItem2 = tree.addItem(item2, addedParent.id);

            expect(tree.getChildren(addedParent.id)).toEqual([addedItem1, addedItem2]);
        });

        it('returns empty array if there are no children for item', () => {
            const tree = new Tree();
            const item = tree.addItem({});

            expect(tree.getChildren(item.id) instanceof Array).toBeTruthy();
            expect(tree.getChildren(item.id).length).toEqual(0);
        });

        it('returns empty array if there is no item', () => {
            const tree = new Tree();
            // const item = tree.addItem({});

            expect(tree.getChildren('321') instanceof Array).toBeTruthy();
            expect(tree.getChildren('321').length).toEqual(0);
        });
    });

    describe('#addItem', () => {
        it('puts new item inside tree and returns same object with id', () => {
            const tree = new Tree();
            const item = {
                data: 'Item',
            };
            const addedItem = tree.addItem(item);

            expect(typeof addedItem.id === 'string').toBeTruthy();
            expect(addedItem.id.length).toBeGreaterThan(0);
            expect(addedItem.children instanceof Array).toBeTruthy();
            expect(addedItem.children.length).toEqual(0);
            expect(addedItem.data).toEqual(item.data);

            expect(tree.tree[addedItem.id]).toEqual(addedItem);
        });

        it('puts new item under parent', () => {
            const tree = new Tree();
            const parentItem = {
                data: 'Parent',
            };
            const item = {
                data: 'Item',
            };
            const addedParentItem = tree.addItem(parentItem);
            const addedItem = tree.addItem(item, addedParentItem.id);

            expect(tree.tree[addedItem.id]).toEqual(addedItem);
            expect(tree.tree[addedItem.id].children.length).toEqual(0);

            expect(tree.tree[addedParentItem.id]).toEqual(parentItem);
            expect(tree.tree[addedParentItem.id].children.length).toEqual(1);
            expect(tree.tree[addedParentItem.id].children).toContain(addedItem.id);
        });

        it('throws error if item undefined', () => {
            const tree = new Tree();

            expect(() => tree.addItem(undefined)).toThrowError(Error, 'Cannot to add undefined item');
        });

        it('throws error if item is not an object', () => {
            const tree = new Tree();

            expect(() => tree.addItem('1')).toThrowError(Error, 'Cannot to add a non-object item');
        });

        it('throws error if there is no parent with id', () => {
            const tree = new Tree();
            const parentId = '321';

            expect(() => tree.addItem({}, parentId))
                .toThrowError(Error, `There is no such parent element with id ${parentId}`);
        });
    });
});
