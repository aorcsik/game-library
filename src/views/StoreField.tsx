export const StoreField = ({ value, stores, required = false }: { value: string; stores: string[]; required?: boolean }) => (
  <>
    <label>Store<input name="store" value={value} list="stores" required={required} maxlength={100} /></label>
    <datalist id="stores">{stores.map(store => <option value={store} />)}</datalist>
  </>
);
