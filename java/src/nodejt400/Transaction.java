package nodejt400;

import java.sql.Connection;

public class Transaction implements ConnectionProvider {

	private final ConnectionProvider connectionProvider;
	private final Connection connection;

	private final JdbcJsonClient client;

	public Transaction(ConnectionProvider connectionProvider) throws Exception {
		this.connectionProvider = connectionProvider;
		this.connection = connectionProvider.getConnection();
		try {
			this.connection.setAutoCommit(false);
		} catch (Exception e) {
			// The caller never receives this object, so end() will never run
			// and nothing else can return the connection.
			try {
				connectionProvider.returnConnection(this.connection);
			} catch (Exception ignored) {
				// Never mask the failure the caller is about to see.
			}
			throw e;
		}
		this.client = new JdbcJsonClient(this);
	}

	public void commit() throws Exception {
		this.connection.commit();
	}

	public void rollback() throws Exception {
		this.connection.rollback();
	}

	public void end() throws Exception {
		try {
			this.connection.setAutoCommit(true);
		} finally {
			this.connectionProvider.returnConnection(this.connection);
		}
	}

	public String query(String sql, String paramsJson, boolean trim)
			throws Exception {
		return client.query(sql, paramsJson, trim);
	}

	public ResultStream queryAsStream(String sql, String paramsJson,
			int bufferSize) throws Exception {
		return client.queryAsStream(sql, paramsJson, bufferSize);
	}

	public StatementWrap execute(String sql, String paramsJson)
			throws Exception {
		return client.execute(sql, paramsJson);
	}

	public TablesReadStream getTablesAsStream(String catalog, String schema, String table) throws Exception {
		return client.getTablesAsStream(catalog, schema, table);
	}

	public String getColumns(String catalog, String schema, String tableNamePattern, String columnNamePattern)
			throws Exception {
		return client.getColumns(catalog, schema, tableNamePattern, columnNamePattern);
	}

	public int update(String sql, String paramsJson)
			throws Exception {
		return client.update(sql, paramsJson);
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception {
		return client.insertAndGetId(sql, paramsJson);
	}

	public int[] batchUpdate(String sql, String paramsListJson)
			throws Exception {
		return client.batchUpdate(sql, paramsListJson);
	}

	@Override
	public Connection getConnection() throws Exception {
		return connection;
	}

	@Override
	public void returnConnection(Connection c) throws Exception {
	}

	@Override
	public void close() {
		try {
			connectionProvider.returnConnection(connection);
		} catch (Exception ex) {
			ex.printStackTrace();
		}
	}
}
