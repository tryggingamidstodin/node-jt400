package nodejt400;

import java.sql.Connection;
import java.sql.DriverManager;

import org.hsqldb.jdbc.JDBCDriver;

public class HsqlClient implements ConnectionProvider
{
	private final JdbcJsonClient client;

	public HsqlClient() throws Exception
	{
		DriverManager.registerDriver(new JDBCDriver());
		client = new JdbcJsonClient(this);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return DriverManager.getConnection("jdbc:hsqldb:mem:test", "quser", "");
	}

	@Override
	public void close(Connection c) throws Exception
	{
		c.close();
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
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
	public String getPrimaryKeys(String catalog, String schema, String table)
	throws Exception
	{
		return client.getPrimaryKeys(catalog, schema, table);
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

	public Transaction createTransaction() throws Exception
	{
		return new Transaction(getConnection());
	}

	public KeyedDataQ createKeyedDataQ(String name)throws Exception
	{
		return null;
	}

	/**
	 * Mock program call
	 * @param programName
	 * @param paramsSchemaJsonStr
	 * @return
	 */
	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(programName, paramsSchemaJsonStr);
	}

	public class Pgm
	{
		public Pgm(String programName, String paramsSchemaJsonStr)
		{
		}

		public String run(String paramsJsonStr)
		{
			return paramsJsonStr;
		}
	}
}
