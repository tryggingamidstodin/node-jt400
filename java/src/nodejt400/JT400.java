package nodejt400;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import com.ibm.as400.access.AS400JDBCConnectionPool;
import com.ibm.as400.access.AS400JDBCConnectionPoolDataSource;
import com.ibm.as400.access.AS400JDBCDriver;

public class JT400
{
	private final ConnectionProvider connectionProvider;

	private final JdbcJsonClient client;

	public JT400(ConnectionProvider connectionProvider)
	{
		this.connectionProvider = connectionProvider;
		this.client = new JdbcJsonClient(connectionProvider);
	}
	public static final JT400 createConnection(String jsonConf)
	throws Exception
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new JT400(new SimpleConnection(conf));
	}

	public static final JT400 createPool(String jsonConf)
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new JT400(new Pool(conf));
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public ResultStream queryAsStream(String sql, String paramsJson,
			int bufferSize) throws Exception {
		return client.queryAsStream(sql, paramsJson, bufferSize);
	}

	public int[] batchUpdate(String sql, String paramsListJson)
			throws Exception {
		return client.batchUpdate(sql, paramsListJson);
	}

	public StatementWrap execute(String sql, String paramsJson)
		throws Exception
	{
			return client.execute(sql, paramsJson);
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
		return new Transaction(connectionProvider.getConnection());
	}

	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(connectionProvider, programName, paramsSchemaJsonStr);
	}

	public KeyedDataQ createKeyedDataQ(String name)throws Exception
	{
		return new KeyedDataQ(connectionProvider, name);
	}

	public IfsReadStream createIfsReadStream(String fileName) throws Exception {
		return new IfsReadStream(connectionProvider, fileName);
	}

	public void close()
	{
		connectionProvider.close();
	}

}

class SimpleConnection implements ConnectionProvider
{
	private final Connection connection;

	public SimpleConnection(JSONObject jsonConf)
	throws Exception
	{
		Connection conn = null;
    Properties connectionProps = new Properties();
    connectionProps.putAll(jsonConf);

		DriverManager.registerDriver(new AS400JDBCDriver());
    connection = DriverManager.getConnection("jdbc:as400://" + jsonConf.get("host"), connectionProps);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return connection;
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
	}

	@Override
	public void close()
	{
		try
		{
			connection.close();
		}
		catch(Exception ex)
		{
			ex.printStackTrace();
		}
	}
}

class Pool implements ConnectionProvider
{
	private final AS400JDBCConnectionPool sqlPool;

	public Pool(JSONObject jsonConf)
	{
		Properties connectionProps = new Properties();
		connectionProps.putAll(jsonConf);
		connectionProps.remove("host");
		connectionProps.remove("user");
		connectionProps.remove("password");

		AS400JDBCConnectionPoolDataSource ds = new AS400JDBCConnectionPoolDataSource();
		ds.setServerName((String) jsonConf.get("host"));
		ds.setUser((String) jsonConf.get("user"));
		ds.setPassword((String) jsonConf.get("password"));
		ds.setProperties(connectionProps);
		this.sqlPool = new AS400JDBCConnectionPool(ds);
		Runtime.getRuntime().addShutdownHook(new Thread()
		{
			@Override
			public void run()
			{
				System.out.println("close connectionpool.");
				sqlPool.close();
			}
		});
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return sqlPool.getConnection();
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
		c.close();
	}

	@Override
	public void close()
	{
		sqlPool.close();
	}
}
