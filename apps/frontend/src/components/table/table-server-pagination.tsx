import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { FilterInput } from './default-filter';
import { authorizedFetch } from '../../shared/auth.service';
import { PaginationActions } from './pagination-actions';
import { HiChevronDownOutline, HiChevronUpDownOutline, HiChevronUpOutline } from '@qwikest/icons/heroicons';
import { EntriesSelector } from './entries-selector';

export enum SortOrder {
  DESC = 'desc',
  ASC = 'asc',
}

export interface PaginationParams {
  limit: number;
  page: number;
  filter: string;
  sort: Record<string, SortOrder>;
}

export type PaginationFetcher = ({ limit, page, filter, sort }: PaginationParams) => Promise<ResponseData>;

export type OptionalHeader = {
  displayName?: string;
  classNames?: string;
  hide?: boolean;
  sortable?: boolean;
};

export type Columns = Record<string, OptionalHeader>;

export interface TableServerPaginationParams {
  endpoint: string;
  columns: Columns;
  pageSize?: number;
  pageSizeOptions?: number[];
}

export interface ResponseData {
  total: number;
  data: Record<string, unknown>[];
}

export const serializeQueryUserPaginationParams = (paginationParams: PaginationParams) => {
  const paramsForQuery = new URLSearchParams();
  paramsForQuery.set('limit', paginationParams.limit.toString());
  paramsForQuery.set('page', paginationParams.page.toString());

  if (paginationParams.filter) {
    paramsForQuery.set('filter', paginationParams.filter);
  }

  if (paginationParams.sort) {
    Object.entries(paginationParams.sort).forEach(([key, value]) => {
      paramsForQuery.set(`sort[${key}]`, value);
    });
  }

  return paramsForQuery.toString();
};

export const TableServerPagination = component$((props: TableServerPaginationParams) => {
  const filter = useSignal('');
  const currentPage = useSignal(1);
  const limit = useSignal(props.pageSize ?? 10);
  const sortSignal = useSignal<Record<string, SortOrder>>({});
  const tableData = useSignal<ResponseData>({ total: 0, data: [] });
  const maxPages = useSignal(0);

  const isOnFirstPage = useSignal(true);
  const isOnLastPage = useSignal(true);

  const isLoading = useSignal(true);

  const fetchTableData: PropFunction<PaginationFetcher> = $(async (paginationParams: PaginationParams) => {
    const queryParams = serializeQueryUserPaginationParams(paginationParams);
    const data = await authorizedFetch(`${props.endpoint}?${queryParams}`);
    const response = (await data.json()) as ResponseData;
    if (!response || !response.data) {
      console.warn('Server response is not valid', response);

      response.total = 0;
      response.data = [];
    }

    return response;
  });

  const onFilterInputChange = $(async (ev: InputEvent) => {
    filter.value = (ev.target as HTMLInputElement).value;
    currentPage.value = 1;
  });

  useVisibleTask$(async ({ track }) => {
    track(() => currentPage.value);
    track(() => limit.value);
    track(() => filter.value);
    track(() => sortSignal.value);

    // Fetch data
    const result = await fetchTableData({
      page: currentPage.value,
      limit: limit.value,
      filter: filter.value,
      sort: sortSignal.value,
    });

    tableData.value = result;
    maxPages.value = Math.ceil(result.total / limit.value || 1);

    // Update isOnFirstPage and isOnLastPage
    isOnFirstPage.value = currentPage.value === 1;
    isOnLastPage.value = currentPage.value >= maxPages.value;

    isLoading.value = false;
  });

  const sortColumn = (columnName: string) =>
    $(() => {
      if (!props.columns[columnName].sortable) return;

      const currentSortOrder = sortSignal.value[columnName];
      if (!currentSortOrder || currentSortOrder === SortOrder.DESC) {
        sortSignal.value = { [columnName]: SortOrder.ASC };
      } else {
        sortSignal.value = { [columnName]: SortOrder.DESC };
      }

      // Reset the page to the first page when sorting
      currentPage.value = 1;
    });

  return (
    <div>
      <div class="inline-flex sm:float-left mx-auto text-sm">
        <EntriesSelector pageSize={limit} pageSizeOptions={props.pageSizeOptions} />
      </div>
      <div class="block sm:float-right sm:w-1/3 sm:pt-0 pt-2 w-1/2 mx-auto">
        <FilterInput filter={filter} onInput={onFilterInputChange} />
      </div>
      {isLoading.value ? ( // Show loader covering the entire table
        <div class="pt-14 animate-pulse">
          <div class="h-4 bg-base-200 mb-6 mt-2 rounded"></div>
          {Array.from({ length: limit.value + 2 }).map(() => (
            <div class="h-4 bg-base-200 mb-6 rounded"></div>
          ))}
        </div>
      ) : (
        <>
          <div>
            <table id="table" class="table table-zebra table-fixed whitespace-nowrap">
              <thead>
                <tr>
                  {Object.keys(props.columns).map((columnName, idx) => {
                    if (props.columns[columnName].hide) return;
                    return (
                      <th class={props.columns[columnName].classNames ?? ''} onClick$={sortColumn(columnName)} key={idx}>
                        {props.columns[columnName].displayName ?? columnName}{' '}
                        {props.columns[columnName].sortable &&
                          (!sortSignal.value[columnName] ? (
                            <HiChevronUpDownOutline class="inline align-text-bottom text-base" />
                          ) : sortSignal.value[columnName] === SortOrder.ASC ? (
                            <HiChevronUpOutline class="inline align-text-bottom" />
                          ) : (
                            <HiChevronDownOutline class="inline align-text-bottom" />
                          ))}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableData.value.data.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Object.keys(props.columns).map((columnName, idx) => {
                      if (props.columns[columnName].hide) return;
                      return <td key={idx}>{row[columnName]?.toString()}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="flex pt-5 text-sm	font-bold">
            <PaginationActions
              tableData={tableData}
              limit={limit}
              page={currentPage}
              maxPages={maxPages}
              isOnFirstPage={isOnFirstPage}
              isOnLastPage={isOnLastPage}
            />
          </div>
        </>
      )}
    </div>
  );
});
