package nodejt400;

import java.sql.Connection;

public class Transaction implements ConnectionProvider
{

	private final Connection connection;

	private final JdbcJsonClient client;

	public Transaction(Connection connection) throws Exception
	{
		this.connection = connection;
		this.connection.setAutoCommit(false);
		this.client = new JdbcJsonClient(this);
	}

	public void commit() throws Exception
	{
		this.connection.commit();
	}

	public void rollback() throws Exception
	{
		this.connection.rollback();
	}

	public void end() throws Exception
	{
		this.connection.setAutoCommit(false);
		this.connection.close();
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public StatementWrap execute(String sql, String paramsJson)
		throws Exception
	{
			return client.execute(sql, paramsJson);
	}

	public ResultSetStream executeAsStream(String sql, String paramsJson, int bufferSize, boolean metadata)
			throws Exception
	{
		return client.executeAsStream(sql, paramsJson, bufferSize, metadata);
	}

	public TablesReadStream getTablesAsStream(String catalog, String schema, String table) throws Exception
	{
		return client.getTablesAsStream(catalog, schema, table);
	}

	public String getColumns(String catalog, String schema, String tableNamePattern, String columnNamePattern)
			throws Exception
	{
		return client.getColumns(catalog, schema, tableNamePattern, columnNamePattern);
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		return client.update(sql, paramsJson);
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception
	{
		return client.insertAndGetId(sql, paramsJson);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return connection;
	}

	@Override
	public void close(Connection c) throws Exception
	{

	}
}
